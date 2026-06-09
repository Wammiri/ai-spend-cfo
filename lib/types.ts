// Canonical usage schema and pricing types (DISCOVERY.md section 7).
//
// This is the single internal shape of the product. Every provider parser maps
// INTO `CanonicalUsageEvent`; the dashboard, the metrics layer, and the memo all
// consume it. There is no database in v1 (D2): this schema is represented as
// these code types plus the methodology page, not as hosted tables. If
// persistence is added later it maps directly onto the spec's Postgres tables.
//
// Batch B0 defines schema types only. The pure functions that compute over them
// (cost derivation, budgets, forecasts, risk, eligibility) arrive in later
// batches under lib/metrics, lib/parsers, and lib/memo.

/**
 * Provenance of a usage row, carried on every event for honest labeling.
 * - `real`: the builder's own genuine AI spend (D9).
 * - `provider-export`: parsed from a real provider export, e.g. Anthropic Console (D5).
 * - `synthetic`: the Northstar sample data, always labeled "sample" in the UI.
 */
export type Source = "real" | "provider-export" | "synthetic";

/** Value tier assigned to a workflow's spend (D6). */
export type ValueTag = "high" | "medium" | "low";

/** Whether the spend was sanctioned. Drives the unapproved-spend risk flag. */
export type ApprovalStatus = "approved" | "unapproved";

/** Where the spend ran. Experiment spend is treated differently from prod. */
export type Environment = "prod" | "experiment";

/** Model cost tier for repricing-based savings (D12). */
export type ModelTier = "frontier" | "mid" | "cheap";

/**
 * One canonical usage event: a single aggregated usage record (one row).
 *
 * Dates are ISO calendar strings (YYYY-MM-DD) so the shape is JSON- and
 * CSV-serializable and matches how providers export.
 *
 * `cost_usd` is always re-derived from the pricing table as the source of truth
 * (D10), even when an export reports its own dollar cost. When a provider does
 * report a cost, it is preserved in `reported_cost_usd` so the methodology page
 * can show a reconciliation delta and flag divergence beyond a threshold.
 */
export interface CanonicalUsageEvent {
  /** Calendar date of the aggregated usage, ISO YYYY-MM-DD. */
  date: string;
  /** Raw actor / API-key label as it appears in the source (pre-mapping). */
  actor: string;
  /** Owning team, resolved via the actor-to-team mapping (D14). */
  team: string;
  /** Workflow this spend belongs to (drives value tagging). */
  workflow: string;
  /** Provider, e.g. "anthropic". */
  provider: string;
  /** Model id, e.g. "claude-opus-4-8". */
  model: string;
  input_tokens: number;
  output_tokens: number;
  /** Cached input tokens, when the provider distinguishes them. */
  cached_input_tokens?: number;
  /** Number of requests aggregated into this row. */
  requests: number;
  /** Cost in USD, re-derived from the pricing table (D10). Source of truth. */
  cost_usd: number;
  /**
   * Cost in USD as reported by the provider export, when present. Stored only
   * for reconciliation against `cost_usd`; never used as the source of truth.
   */
  reported_cost_usd?: number | null;
  /** Assigned value tier (D6). */
  value_tag: ValueTag;
  /** Whether the spend was sanctioned. */
  approval_status: ApprovalStatus;
  /** Execution environment. */
  environment: Environment;
  /** Project, nullable. A null project fires the missing-owner flag. */
  project: string | null;
  /** Provenance, for honest labeling (real / provider-export / synthetic). */
  source: Source;
}

/**
 * One pricing row. Prices are versioned by `effective_date` (D11): for any
 * event, select the latest row with `effective_date <= event.date`. Prices are
 * quoted per one million tokens.
 */
export interface PricingRow {
  provider: string;
  model: string;
  input_price_per_1m: number;
  output_price_per_1m: number;
  /** Cached-input price per 1M tokens, when the provider offers cached pricing. */
  cached_input_price_per_1m?: number;
  /** ISO YYYY-MM-DD date this price became effective. */
  effective_date: string;
}
