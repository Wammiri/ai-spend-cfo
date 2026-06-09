// Anthropic Console usage/cost export parser (D5). This is the first real
// provider export (Tier 2): the builder uses Claude, so the real Tier-1 own-spend
// and this Tier-2 parser exercise the same provider and close the credibility
// loop. Every row maps INTO the canonical schema; the governance dimensions the
// export does not carry (team, workflow, project, value tier) are resolved later
// by the actor-to-team mapping (D14).
//
// FORMAT IS PENDING RECONFIRMATION (D5, human gate). The exact column names in
// the current Anthropic Console export are reconfirmed before this is finalized.
// To make that a one-line change, the assumed column names live in COLUMN_MAP
// below and the resolver accepts common aliases case-insensitively. Adjust
// COLUMN_MAP to the confirmed headers and the rest of the pipeline is unaffected.
// The bundled data/sample-anthropic-export.csv documents the assumed shape.
//
// The export reports a dollar cost; per D10 that is captured only as
// `reported_cost_usd` for the reconciliation flex, and the real cost is
// re-derived from the pricing table downstream. Untrusted-input handling matches
// the canonical parser: issues are reported not thrown, rows are capped (D15),
// and values are coerced and range-checked.

import Papa from "papaparse";
import type {
  ParseIssue,
  ParseResult,
  RawUsageRow,
  Source,
} from "../types";
import { isValidDate, MAX_ROWS } from "./canonical-csv";

/**
 * Assumed Anthropic Console export columns, with accepted aliases. This is the
 * single place to adjust when the exact export format is reconfirmed (D5). The
 * first alias present in the file wins; matching is case-insensitive and trimmed.
 */
export const COLUMN_MAP = {
  date: ["date", "usage_date", "usage_date_utc", "day"],
  actor: ["api_key", "api_key_name", "key_name", "workspace", "workspace_name", "key"],
  model: ["model"],
  input_tokens: ["input_tokens", "uncached_input_tokens", "prompt_tokens"],
  output_tokens: ["output_tokens", "completion_tokens"],
  cached_input_tokens: ["cache_read_input_tokens", "cache_read_tokens", "cached_input_tokens"],
  requests: ["requests", "request_count", "api_requests", "calls"],
  cost: ["cost", "cost_usd", "amount_usd", "total_cost_usd", "amount"],
} as const;

function buildHeaderIndex(fields: string[]): Map<keyof typeof COLUMN_MAP, string> {
  const present = new Map<keyof typeof COLUMN_MAP, string>();
  const lower = new Map(fields.map((f) => [f.trim().toLowerCase(), f] as const));
  for (const key of Object.keys(COLUMN_MAP) as (keyof typeof COLUMN_MAP)[]) {
    for (const alias of COLUMN_MAP[key]) {
      const hit = lower.get(alias);
      if (hit) {
        present.set(key, hit);
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

/**
 * Parse an Anthropic Console export. Provider is always "anthropic" (the console
 * exports Anthropic usage only). `source` defaults to "provider-export" for a
 * genuine user upload; the bundled sample passes "synthetic" so it is never shown
 * as real spend.
 */
export function parseAnthropicConsole(
  text: string,
  source: Source = "provider-export",
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

  const required: (keyof typeof COLUMN_MAP)[] = ["date", "model", "input_tokens", "output_tokens"];
  const missing = required.filter((f) => !idx.has(f));
  if (missing.length > 0) {
    issues.push({
      row: 0,
      message: `Not an Anthropic Console export: missing ${missing.join(", ")}. If the format changed, update COLUMN_MAP (D5).`,
      severity: "error",
    });
    return { rows, issues, format: "anthropic-console" };
  }

  const get = (rec: Record<string, string>, field: keyof typeof COLUMN_MAP): string | undefined => {
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
    const rowNo = i + 1;

    const date = get(rec, "date")?.trim() ?? "";
    if (!isValidDate(date)) {
      issues.push({ row: rowNo, field: "date", message: `Invalid date "${date}", expected YYYY-MM-DD. Row skipped.`, severity: "error" });
      continue;
    }

    const input_tokens = num(get(rec, "input_tokens"));
    const output_tokens = num(get(rec, "output_tokens"));
    if (input_tokens === null || output_tokens === null || input_tokens < 0 || output_tokens < 0) {
      issues.push({ row: rowNo, message: "Non-numeric or negative token value. Row skipped.", severity: "error" });
      continue;
    }

    const cached = num(get(rec, "cached_input_tokens"));
    const requests = num(get(rec, "requests"));
    const cost = num(get(rec, "cost"));

    rows.push({
      date,
      actor: get(rec, "actor")?.trim() || "unknown-key",
      provider: "anthropic",
      model: get(rec, "model")?.trim() || "unknown",
      input_tokens,
      output_tokens,
      ...(cached !== null && cached >= 0 ? { cached_input_tokens: cached } : {}),
      // Export rows are usually already daily aggregates; default a missing
      // request count to 1 so cost-per-request stays finite.
      requests: requests !== null && requests >= 0 ? requests : 1,
      reported_cost_usd: cost,
      // team/workflow/value_tag/etc deliberately unset: the mapping (D14) resolves them.
      source,
    });
  }

  if (rows.length === 0 && issues.every((i) => i.severity !== "error")) {
    issues.push({ row: 0, message: "No data rows found.", severity: "warning" });
  }

  return { rows, issues, format: "anthropic-console" };
}

/** Sniff whether CSV text looks like an Anthropic export (for format auto-detect). */
export function looksLikeAnthropicExport(text: string): boolean {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const headers = firstLine.split(",").map((h) => h.trim().toLowerCase());
  const hasModel = headers.includes("model");
  const hasTeam = headers.includes("team") || headers.includes("department");
  // canonical CSV carries team; an Anthropic export has model + cost/tokens but no team
  const hasCost = COLUMN_MAP.cost.some((c) => headers.includes(c));
  const hasTokens = COLUMN_MAP.input_tokens.some((c) => headers.includes(c));
  return hasModel && !hasTeam && (hasCost || hasTokens);
}
