// Curated, versioned pricing table (D11). Every cost in the product is
// re-derived from this table (D10), so it is the single price source of truth.
//
// HONESTY / HUMAN GATE: the values below are illustrative public list prices,
// per one million tokens, entered by the builder. They are NOT yet
// human-confirmed, so the methodology page labels them "pending confirmation"
// and never as authoritative until the human gate (DISCOVERY section 12, D11)
// is cleared. Replacing a value is a one-line edit here; nothing else changes.
//
// Versioning (D11): a model can have several rows with different `effective_date`
// values. For any event, `selectPrice` picks the latest row whose effective_date
// is on or before the event date, so historical spend stays correctly priced
// when a vendor changes a price mid-stream. Cached-input pricing is optional and
// only set where the provider distinguishes cached reads.

import type { PricingRow } from "../types";

/**
 * The date these prices were last reviewed by the builder. Shown as
 * "prices as of ..." on the methodology page (D11).
 */
export const PRICES_AS_OF = "2026-06-01";

/**
 * True once the human has confirmed the seeded values against current vendor
 * pricing (DISCOVERY section 12 gate). Flipped by the human, not by code. While
 * false, the methodology page shows the "pending confirmation" label. This is
 * the one-line switch for the pricing human gate.
 */
export const PRICING_CONFIRMED = false;

/**
 * Curated price rows, USD per 1M tokens. Ordered newest-first per model only for
 * readability; `selectPrice` does not rely on array order. Most models carry a
 * single current row; `claude-opus-4-8` carries a prior row too, to exercise and
 * demonstrate effective-date versioning (D11).
 */
export const PRICING_TABLE: readonly PricingRow[] = [
  // Anthropic (the provider behind the real Tier-1 data and the Tier-2 parser, D5).
  { provider: "anthropic", model: "claude-opus-4-8", input_price_per_1m: 15, output_price_per_1m: 75, cached_input_price_per_1m: 1.5, effective_date: "2026-01-01" },
  { provider: "anthropic", model: "claude-opus-4-8", input_price_per_1m: 18, output_price_per_1m: 90, cached_input_price_per_1m: 1.8, effective_date: "2025-06-01" },
  { provider: "anthropic", model: "claude-sonnet-4-6", input_price_per_1m: 3, output_price_per_1m: 15, cached_input_price_per_1m: 0.3, effective_date: "2026-01-01" },
  { provider: "anthropic", model: "claude-haiku-4-5", input_price_per_1m: 1, output_price_per_1m: 5, cached_input_price_per_1m: 0.1, effective_date: "2026-01-01" },

  // OpenAI (illustrative; included as common models so cross-provider uploads price).
  { provider: "openai", model: "gpt-5", input_price_per_1m: 12, output_price_per_1m: 48, effective_date: "2026-01-01" },
  { provider: "openai", model: "gpt-5-mini", input_price_per_1m: 0.6, output_price_per_1m: 2.4, effective_date: "2026-01-01" },

  // Google (illustrative).
  { provider: "google", model: "gemini-2.5-pro", input_price_per_1m: 7, output_price_per_1m: 21, effective_date: "2026-01-01" },
  { provider: "google", model: "gemini-2.5-flash", input_price_per_1m: 0.3, output_price_per_1m: 1.2, effective_date: "2026-01-01" },
];

/** Normalize identifiers so lookups are robust to case and stray whitespace. */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Select the price row in effect for a (provider, model) on a given event date:
 * the latest row with `effective_date <= date` (D11). Returns null when the
 * model is not in the table, so callers can flag unpriced models honestly rather
 * than silently costing them at zero.
 */
export function selectPrice(
  provider: string,
  model: string,
  date: string,
  table: readonly PricingRow[] = PRICING_TABLE,
): PricingRow | null {
  let best: PricingRow | null = null;
  for (const row of table) {
    if (norm(row.provider) !== norm(provider) || norm(row.model) !== norm(model)) continue;
    if (row.effective_date > date) continue;
    if (best === null || row.effective_date > best.effective_date) best = row;
  }
  return best;
}

/** The distinct models the table can price, newest effective row per model. */
export function pricedModels(table: readonly PricingRow[] = PRICING_TABLE): PricingRow[] {
  const latest = new Map<string, PricingRow>();
  for (const row of table) {
    const key = `${norm(row.provider)}|${norm(row.model)}`;
    const cur = latest.get(key);
    if (!cur || row.effective_date > cur.effective_date) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) =>
    a.provider === b.provider ? a.model.localeCompare(b.model) : a.provider.localeCompare(b.provider),
  );
}
