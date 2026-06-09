// The only server code in the product (D3, D17): the live memo route. A user
// upload triggers a single Claude call here, with the API key held server-side
// and the route rate-limited. The architectural laws are enforced at this
// boundary: the route receives only code-computed inputs, injects only those into
// the prompt (control C2 supplied set), and post-validates the model output so no
// unsupported dollar figure survives (control C2). It also runs the Haiku
// value-tag classifier (D6) on the same key, server-side.
//
// Security posture (light weight class, single-tenant demo): the key never
// reaches the client; the request body is size-capped and every string that
// reaches the prompt is reconstructed and sanitized from untrusted JSON, so an
// uploaded CSV cannot smuggle instructions into the prompt; the model output is
// constrained to a JSON schema, so injected text cannot change app behavior, and
// C2 strips any fabricated number regardless. Rate limiting is best-effort
// in-memory (it resets on a cold start); it is a demo guard, not a hard quota.

import Anthropic from "@anthropic-ai/sdk";
import type { Source } from "@/lib/types";
import type { BudgetStatus } from "@/lib/metrics/budget";
import type { BudgetReport } from "@/lib/metrics/aggregate";
import {
  assembleMemo,
  collectMemoFigures,
  type MemoInputs,
  type MemoNarrative,
} from "@/lib/memo/build-inputs";
import {
  buildClassifyUserPrompt,
  buildMemoUserPrompt,
  CLASSIFY_MODEL,
  CLASSIFY_SCHEMA,
  CLASSIFY_SYSTEM,
  MEMO_MODEL,
  MEMO_SCHEMA,
  MEMO_SYSTEM,
  parseTierSuggestions,
} from "@/lib/memo/prompt";
import { sanitizeMemo } from "@/lib/memo/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// --- rate limiting (best-effort, in-memory) ----------------------------------

const WINDOW_MS = 60_000;
const LIMIT = 8; // requests per IP per window; Opus calls are expensive
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? "").trim() || req.headers.get("x-real-ip") || "local";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// --- input sanitization (untrusted JSON -> typed MemoInputs) ------------------

const MAX_BODY_BYTES = 1_000_000;
// Matches ASCII control characters (so uploaded strings cannot inject newlines
// or escapes into the prompt). Built from char codes to keep the source clean.
const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`, "g");

function num(x: unknown, d = 0): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function numOrNull(x: unknown): number | null {
  return x === null || x === undefined ? null : num(x);
}

function txt(x: unknown, max = 160): string {
  return typeof x === "string" ? x.replace(CONTROL_CHARS, " ").slice(0, max) : "";
}

const BUDGET_STATUSES: BudgetStatus[] = ["healthy", "at-risk", "overrun", "no-budget", "early"];
function status(x: unknown): BudgetStatus {
  return BUDGET_STATUSES.includes(x as BudgetStatus) ? (x as BudgetStatus) : "no-budget";
}

function sanitizeBudgetLine(raw: Record<string, unknown>) {
  return {
    key: txt(raw.key, 80),
    budget: numOrNull(raw.budget),
    actual: num(raw.actual),
    pace: num(raw.pace),
    expected: numOrNull(raw.expected),
    varianceToDate: numOrNull(raw.varianceToDate),
    projected: num(raw.projected),
    projectedVariance: numOrNull(raw.projectedVariance),
    usedPct: numOrNull(raw.usedPct),
    projectedUsedPct: numOrNull(raw.projectedUsedPct),
    status: status(raw.status),
  };
}

function sanitizeBudget(raw: unknown): BudgetReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lines = (Array.isArray(r.lines) ? r.lines : [])
    .slice(0, 40)
    .map((l) => sanitizeBudgetLine(l as Record<string, unknown>));
  const total = sanitizeBudgetLine((r.total ?? {}) as Record<string, unknown>);
  return { dimension: txt(r.dimension, 40), lines, total };
}

function sanitizeForecast(raw: unknown): MemoInputs["forecast"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const confidence = ["early", "projected", "closed"].includes(r.confidence as string)
    ? (r.confidence as "early" | "projected" | "closed")
    : "closed";
  const scenarios = (Array.isArray(r.scenarios) ? r.scenarios : []).slice(0, 6).map((s) => {
    const sr = s as Record<string, unknown>;
    const key = ["base", "upside", "control"].includes(sr.key as string)
      ? (sr.key as "base" | "upside" | "control")
      : "base";
    return { key, label: txt(sr.label, 80), amount: num(sr.amount) };
  });
  return {
    actualToDate: num(r.actualToDate),
    runRate: num(r.runRate),
    recentTrend: num(r.recentTrend),
    projected: num(r.projected),
    scenarios,
    controlSavings: num(r.controlSavings),
    confidence,
    daysElapsed: num(r.daysElapsed),
    daysInMonth: num(r.daysInMonth),
    daysRemaining: num(r.daysRemaining),
  };
}

function sanitizeSource(x: unknown): Source {
  return x === "synthetic" || x === "provider-export" ? x : "real";
}

/** Rebuild MemoInputs from untrusted JSON, capping sizes and stripping control chars. */
function sanitizeInputs(raw: unknown): MemoInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sm = (r.summary ?? {}) as Record<string, unknown>;

  const summary: MemoInputs["summary"] = {
    org: txt(sm.org, 80) || "Your organization",
    periodLabel: txt(sm.periodLabel, 60) || "the period",
    currency: txt(sm.currency, 8) || "USD",
    totalSpend: num(sm.totalSpend),
    totalRequests: Math.round(num(sm.totalRequests)),
    costPerRequest: num(sm.costPerRequest),
    frontierSpend: num(sm.frontierSpend),
    frontierShare: num(sm.frontierShare),
    lowValueSpend: num(sm.lowValueSpend),
    unapprovedSpend: num(sm.unapprovedSpend),
    missingOwnerSpend: num(sm.missingOwnerSpend),
  };

  const drivers = (Array.isArray(r.drivers) ? r.drivers : []).slice(0, 10).map((d) => {
    const dr = d as Record<string, unknown>;
    return { label: txt(dr.label, 120), value: num(dr.value), share: num(dr.share), events: Math.round(num(dr.events)) };
  });

  const needsReview = (Array.isArray(r.needsReview) ? r.needsReview : []).slice(0, 8).map((nr) => {
    const x = nr as Record<string, unknown>;
    return { label: txt(x.label, 120), reason: txt(x.reason, 300) };
  });

  const riskFlags = (Array.isArray(r.riskFlags) ? r.riskFlags : []).slice(0, 12).map((f) => {
    const fr = f as Record<string, unknown>;
    return {
      key: txt(fr.key, 40),
      label: txt(fr.label, 120),
      detail: txt(fr.detail, 400),
      impact_usd: num(fr.impact_usd),
      recommendation: txt(fr.recommendation, 300),
    };
  });

  return {
    summary,
    drivers,
    needsReview,
    riskFlags,
    budget: sanitizeBudget(r.budget),
    forecast: sanitizeForecast(r.forecast),
    source: sanitizeSource(r.source),
    periodStatus: txt(r.periodStatus, 24) || "actuals",
  };
}

// --- the Claude calls --------------------------------------------------------

function textOf(message: Anthropic.Message): string {
  return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function generateMemo(client: Anthropic, inputs: MemoInputs): Promise<Response> {
  const message = await client.messages.create({
    model: MEMO_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: MEMO_SCHEMA as unknown as Record<string, unknown> },
    },
    system: MEMO_SYSTEM,
    messages: [{ role: "user", content: buildMemoUserPrompt(inputs) }],
  });

  if (message.stop_reason === "refusal") {
    return Response.json({ error: "The model declined to generate this memo." }, { status: 502 });
  }

  let narrative: MemoNarrative;
  try {
    narrative = JSON.parse(textOf(message)) as MemoNarrative;
  } catch {
    return Response.json({ error: "The model returned an unreadable memo. Please try again." }, { status: 502 });
  }

  // Control C2: assemble with code-computed numbers, then strip any dollar figure
  // the model emitted that does not trace to a supplied input.
  const doc = assembleMemo(inputs, narrative);
  const supplied = collectMemoFigures(inputs);
  const { memo, validation } = sanitizeMemo(doc, supplied);

  return Response.json({ memo, validation });
}

async function classifyTiers(client: Anthropic, labels: string[]): Promise<Response> {
  const message = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 1024,
    system: CLASSIFY_SYSTEM,
    output_config: { format: { type: "json_schema", schema: CLASSIFY_SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: "user", content: buildClassifyUserPrompt(labels) }],
  });
  return Response.json({ suggestions: parseTierSuggestions(textOf(message)) });
}

// --- handler -----------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(clientIp(req))) {
    return Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The memo service is not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return Response.json({ error: "Request too large." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const client = new Anthropic();

  try {
    if (b.action === "classify") {
      const labels = (Array.isArray(b.labels) ? b.labels : [])
        .map((l) => txt(l, 120))
        .filter((l) => l.length > 0)
        .slice(0, 40);
      if (labels.length === 0) {
        return Response.json({ error: "No labels to classify." }, { status: 400 });
      }
      return await classifyTiers(client, labels);
    }

    const inputs = sanitizeInputs(b.inputs);
    if (!inputs) {
      return Response.json({ error: "Missing computed inputs." }, { status: 400 });
    }
    return await generateMemo(client, inputs);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "The model is rate limited. Please try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      // Misconfiguration on the server side; never echo the key or the detail.
      return Response.json({ error: "The memo service is not configured." }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: "The model is unavailable right now. Please try again." }, { status: 502 });
    }
    return Response.json({ error: "Unexpected error generating the memo." }, { status: 500 });
  }
}
