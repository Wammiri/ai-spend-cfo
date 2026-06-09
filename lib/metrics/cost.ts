// Deterministic cost derivation and provider-cost reconciliation (D10).
//
// Architectural law (CLAUDE.md, DISCOVERY section 4): code computes every number;
// the AI never calculates. This module is the canonical cost engine. It always
// re-derives `cost_usd` from the pricing table as the source of truth, even when
// an export reports its own dollar figure. The reported figure is preserved only
// to compute a reconciliation delta and flag divergence beyond a threshold, which
// is itself the finance-credibility flex (D10).
//
// Everything here is pure: tokens plus a pricing table in, numbers out. No IO.
// `buildCanonicalEvents` is the one ingestion entry point: it takes the rows a
// parser produced, resolves governance dimensions through the actor-to-team
// mapping (D14), derives every cost, and returns canonical events plus a
// reconciliation summary the UI renders. Tier-based repricing for savings (D12)
// is deliberately NOT here; that is B4.

import type {
  CanonicalUsageEvent,
  PricingRow,
  RawUsageRow,
} from "../types";
import { PRICING_TABLE, selectPrice } from "../pricing/pricing-table";
import {
  DEFAULT_MAPPING,
  resolveDimensions,
  type ActorMapping,
} from "../mapping/actor-team";

/**
 * Relative delta beyond which a reconciliation is flagged (D10), as a fraction.
 * One-line switch: 0.01 = 1%. A small absolute floor (below) prevents rounding
 * dust on tiny rows from tripping the flag.
 */
export const RECONCILE_THRESHOLD_PCT = 0.01;
const RECONCILE_FLOOR_USD = 0.01;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Tokens for one row, in the shape the cost formula needs. */
export interface TokenCounts {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
}

/**
 * The deterministic cost formula (DISCOVERY section 7, D10), per one row, given
 * the price row in effect. Cached input is priced at the cached rate when the
 * provider offers one, otherwise it falls back to the standard input rate so a
 * missing cached price never silently zeroes those tokens.
 */
export function deriveCost(tokens: TokenCounts, price: PricingRow): number {
  const input = (tokens.input_tokens / 1e6) * price.input_price_per_1m;
  const output = (tokens.output_tokens / 1e6) * price.output_price_per_1m;
  const cachedRate = price.cached_input_price_per_1m ?? price.input_price_per_1m;
  const cached = ((tokens.cached_input_tokens ?? 0) / 1e6) * cachedRate;
  return round2(input + output + cached);
}

export interface RowReconciliation {
  derived: number;
  reported: number | null;
  delta: number;
  deltaPct: number | null;
  flagged: boolean;
}

/** Compare a derived cost against a reported one (D10). */
export function reconcileValue(derived: number, reported: number | null | undefined): RowReconciliation {
  if (reported === null || reported === undefined) {
    return { derived, reported: null, delta: 0, deltaPct: null, flagged: false };
  }
  const delta = round2(derived - reported);
  const deltaPct = reported === 0 ? null : delta / reported;
  const flagged =
    Math.abs(delta) > RECONCILE_FLOOR_USD &&
    (deltaPct === null || Math.abs(deltaPct) > RECONCILE_THRESHOLD_PCT);
  return { derived, reported, delta, deltaPct, flagged };
}

export interface ModelReconciliation {
  provider: string;
  model: string;
  derived: number;
  reported: number;
  delta: number;
  deltaPct: number | null;
  flagged: boolean;
}

export interface ReconciliationSummary {
  /** True only if the source reported any cost at all (else there is nothing to reconcile). */
  hasReported: boolean;
  totalDerived: number;
  totalReported: number;
  delta: number;
  deltaPct: number | null;
  /** Per-model rollup, largest derived spend first. */
  byModel: ModelReconciliation[];
  /** Models flagged as diverging beyond the threshold. */
  flaggedCount: number;
  thresholdPct: number;
}

export interface IngestResult {
  events: CanonicalUsageEvent[];
  reconciliation: ReconciliationSummary;
  /** Distinct provider+model pairs with no price row, costed at 0 and surfaced to the user. */
  unpricedModels: string[];
  /** Distinct raw actors that fell through the mapping to "Unassigned" (D14). */
  unmappedActors: string[];
}

/**
 * Turn parsed rows into canonical events: resolve dimensions through the mapping
 * (D14), re-derive every cost from the pricing table (D10), and reconcile against
 * any reported cost. This is the single ingestion pipeline behind the upload
 * surface. Pure: same rows + mapping + table give the same result every time.
 */
export function buildCanonicalEvents(
  rows: RawUsageRow[],
  opts: {
    mapping?: ActorMapping;
    table?: readonly PricingRow[];
    /** Stamp onto resulting events when the row does not carry its own source. */
    defaultSource?: CanonicalUsageEvent["source"];
  } = {},
): IngestResult {
  const mapping = opts.mapping ?? DEFAULT_MAPPING;
  const table = opts.table ?? PRICING_TABLE;

  const events: CanonicalUsageEvent[] = [];
  const unpriced = new Set<string>();
  const unmapped = new Set<string>();

  // reconciliation accumulators, keyed by provider|model
  const modelAcc = new Map<string, { provider: string; model: string; derived: number; reported: number; anyReported: boolean }>();
  let anyReported = false;

  for (const row of rows) {
    const price = selectPrice(row.provider, row.model, row.date, table);
    const cost_usd = price
      ? deriveCost(row, price)
      : 0;
    if (!price) unpriced.add(`${row.provider}/${row.model}`);

    // Resolve governance dimensions. Rows that already carry them (canonical CSV)
    // pass straight through; provider-export rows are resolved from the actor.
    const dims = resolveDimensions(row, mapping);
    if (dims.unmapped) unmapped.add(row.actor);

    const reported = row.reported_cost_usd ?? null;
    if (reported !== null) anyReported = true;

    const key = `${row.provider}|${row.model}`;
    const acc = modelAcc.get(key) ?? { provider: row.provider, model: row.model, derived: 0, reported: 0, anyReported: false };
    acc.derived += cost_usd;
    if (reported !== null) {
      acc.reported += reported;
      acc.anyReported = true;
    }
    modelAcc.set(key, acc);

    events.push({
      date: row.date,
      actor: row.actor,
      team: dims.team,
      workflow: dims.workflow,
      provider: row.provider,
      model: row.model,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      ...(row.cached_input_tokens !== undefined ? { cached_input_tokens: row.cached_input_tokens } : {}),
      requests: row.requests,
      cost_usd,
      reported_cost_usd: reported,
      value_tag: dims.value_tag,
      approval_status: dims.approval_status,
      environment: dims.environment,
      project: dims.project,
      source: row.source ?? opts.defaultSource ?? "provider-export",
    });
  }

  const byModel: ModelReconciliation[] = [...modelAcc.values()]
    .filter((m) => m.anyReported)
    .map((m) => {
      const derived = round2(m.derived);
      const reported = round2(m.reported);
      const r = reconcileValue(derived, reported);
      return { provider: m.provider, model: m.model, derived, reported, delta: r.delta, deltaPct: r.deltaPct, flagged: r.flagged };
    })
    .sort((a, b) => b.derived - a.derived);

  const totalDerived = round2(byModel.reduce((s, m) => s + m.derived, 0));
  const totalReported = round2(byModel.reduce((s, m) => s + m.reported, 0));
  const totalRecon = reconcileValue(totalDerived, anyReported ? totalReported : null);

  return {
    events,
    reconciliation: {
      hasReported: anyReported,
      totalDerived: round2(events.reduce((s, e) => s + e.cost_usd, 0)),
      totalReported,
      delta: totalRecon.delta,
      deltaPct: totalRecon.deltaPct,
      byModel,
      flaggedCount: byModel.filter((m) => m.flagged).length,
      thresholdPct: RECONCILE_THRESHOLD_PCT,
    },
    unpricedModels: [...unpriced].sort(),
    unmappedActors: [...unmapped].sort(),
  };
}
