// Canonical CSV parser. The canonical schema (DISCOVERY section 7) is the single
// internal shape; this reads a CSV already in that shape (the format the
// downloadable sample-canonical.csv documents) into RawUsageRow[]. Cost is NOT
// trusted from the CSV: any cost column is captured as `reported_cost_usd` for
// reconciliation only, and the real cost is re-derived downstream (D10).
//
// Parsing is in-browser and the input is untrusted (D8): one bad row is reported
// as an issue, never thrown, so a single malformed line cannot break an upload;
// the row count is capped (D15) so a pathological file cannot hang the tab; and
// every value is coerced and range-checked before it enters the pipeline. React
// escapes any string on render, so CSV content cannot inject markup.

import Papa from "papaparse";
import type {
  ApprovalStatus,
  Environment,
  ParseIssue,
  ParseResult,
  RawUsageRow,
  Source,
  ValueTag,
} from "../types";

/** Hard cap on rows parsed in-browser (D15: design for ~50k canonical rows). */
export const MAX_ROWS = 50_000;

/** Accepted header aliases per canonical field (case-insensitive, trimmed). */
const HEADERS: Record<string, string[]> = {
  date: ["date", "day", "usage_date"],
  actor: ["actor", "api_key", "api_key_name", "key", "workspace"],
  team: ["team", "department"],
  workflow: ["workflow", "use_case", "usecase"],
  provider: ["provider", "vendor"],
  model: ["model"],
  input_tokens: ["input_tokens", "prompt_tokens", "input"],
  output_tokens: ["output_tokens", "completion_tokens", "output"],
  cached_input_tokens: ["cached_input_tokens", "cache_read_tokens", "cached_tokens"],
  requests: ["requests", "request_count", "calls"],
  reported_cost: ["reported_cost_usd", "cost_usd", "cost", "amount_usd", "amount"],
  value_tag: ["value_tag", "value", "tier"],
  approval_status: ["approval_status", "approval", "approved"],
  environment: ["environment", "env"],
  project: ["project"],
  source: ["source", "provenance"],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date in YYYY-MM-DD form (rejects 2026-13-99). */
export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function buildHeaderIndex(fields: string[]): Map<string, string> {
  // canonical field -> the actual header present in the file
  const present = new Map<string, string>();
  const lower = new Map(fields.map((f) => [f.trim().toLowerCase(), f] as const));
  for (const [canonical, aliases] of Object.entries(HEADERS)) {
    for (const alias of aliases) {
      const hit = lower.get(alias);
      if (hit) {
        present.set(canonical, hit);
        break;
      }
    }
  }
  return present;
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim().replace(/[$,]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function asValueTag(raw: string | undefined): ValueTag | null {
  const s = raw?.trim().toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  if (s === "med") return "medium";
  return null;
}

function asApproval(raw: string | undefined): ApprovalStatus | null {
  const s = raw?.trim().toLowerCase();
  if (s === "approved" || s === "unapproved") return s;
  if (s === "true" || s === "yes") return "approved";
  if (s === "false" || s === "no") return "unapproved";
  return null;
}

function asEnvironment(raw: string | undefined): Environment | null {
  const s = raw?.trim().toLowerCase();
  if (s === "prod" || s === "production") return "prod";
  if (s === "experiment" || s === "exp" || s === "dev" || s === "staging") return "experiment";
  return null;
}

function asSource(raw: string | undefined): Source | null {
  const s = raw?.trim().toLowerCase();
  if (s === "real" || s === "provider-export" || s === "synthetic") return s;
  return null;
}

/**
 * Parse canonical-schema CSV text. `defaultSource` stamps rows that do not carry
 * a source column (the genuine upload path uses "real"; the bundled sample uses
 * "synthetic" so it is never shown as real spend).
 */
export function parseCanonicalCsv(
  text: string,
  defaultSource: Source = "real",
): ParseResult {
  const issues: ParseIssue[] = [];
  const rows: RawUsageRow[] = [];

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const idx = buildHeaderIndex(fields);

  // `actor` is optional for canonical CSV: the row already carries `team`, which
  // identifies the owner. A provider export, which lacks team, is the path where
  // the actor is load-bearing.
  const required = ["date", "provider", "model", "input_tokens", "output_tokens", "requests"];
  const missing = required.filter((f) => !idx.has(f));
  if (missing.length > 0) {
    issues.push({ row: 0, message: `Missing required column(s): ${missing.join(", ")}. Expected canonical headers.`, severity: "error" });
    return { rows, issues, format: "canonical" };
  }

  const get = (rec: Record<string, string>, field: string): string | undefined => {
    const header = idx.get(field);
    return header ? rec[header] : undefined;
  };

  const data = parsed.data;
  const limit = Math.min(data.length, MAX_ROWS);
  if (data.length > MAX_ROWS) {
    issues.push({ row: 0, message: `File has ${data.length} rows; only the first ${MAX_ROWS} are processed (in-browser limit).`, severity: "warning" });
  }

  for (let i = 0; i < limit; i++) {
    const rec = data[i];
    const rowNo = i + 1; // 1-based, header excluded

    const date = get(rec, "date")?.trim() ?? "";
    if (!isValidDate(date)) {
      issues.push({ row: rowNo, field: "date", message: `Invalid date "${date}", expected YYYY-MM-DD. Row skipped.`, severity: "error" });
      continue;
    }

    const input_tokens = num(get(rec, "input_tokens"));
    const output_tokens = num(get(rec, "output_tokens"));
    const requests = num(get(rec, "requests"));
    if (input_tokens === null || output_tokens === null || requests === null || input_tokens < 0 || output_tokens < 0 || requests < 0) {
      issues.push({ row: rowNo, message: "Non-numeric or negative token/request value. Row skipped.", severity: "error" });
      continue;
    }

    const cached = num(get(rec, "cached_input_tokens"));
    const reported = num(get(rec, "reported_cost"));

    const valueRaw = get(rec, "value_tag");
    const value_tag = asValueTag(valueRaw);
    if (valueRaw && value_tag === null) {
      issues.push({ row: rowNo, field: "value_tag", message: `Unrecognized value_tag "${valueRaw}", defaulted to medium.`, severity: "warning" });
    }
    const approvalRaw = get(rec, "approval_status");
    const approval = asApproval(approvalRaw);
    const envRaw = get(rec, "environment");
    const environment = asEnvironment(envRaw);
    const projectRaw = get(rec, "project")?.trim();
    const sourceRaw = get(rec, "source");

    rows.push({
      date,
      actor: get(rec, "actor")?.trim() || "unknown",
      team: get(rec, "team")?.trim() || undefined,
      workflow: get(rec, "workflow")?.trim() || undefined,
      provider: get(rec, "provider")?.trim() || "unknown",
      model: get(rec, "model")?.trim() || "unknown",
      input_tokens,
      output_tokens,
      ...(cached !== null && cached >= 0 ? { cached_input_tokens: cached } : {}),
      requests,
      reported_cost_usd: reported,
      value_tag: value_tag ?? undefined,
      approval_status: approval ?? undefined,
      environment: environment ?? undefined,
      project: projectRaw === undefined || projectRaw === "" ? null : projectRaw,
      source: asSource(sourceRaw) ?? defaultSource,
    });
  }

  if (rows.length === 0 && issues.every((i) => i.severity !== "error")) {
    issues.push({ row: 0, message: "No data rows found.", severity: "warning" });
  }

  return { rows, issues, format: "canonical" };
}
