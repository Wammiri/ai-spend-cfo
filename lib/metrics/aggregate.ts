// Load-time, read-only aggregations for the dashboard and the cached memo (B1).
//
// Architectural law (CLAUDE.md, DISCOVERY section 4): deterministic code computes
// every number; the AI never calculates. This module is that code for the static
// demo. It takes a normalized dataset and returns pure sums and groupings. The
// dashboard and the memo view consume this output; they never recompute.
//
// SCOPE (B1): spend COMPOSITION and waste INDICATORS only, all expressible as
// simple sums/groupings over the canonical events. Budgets, pace, variance,
// forecast scenarios (B3, D13) and live model-tier repricing for savings (B4,
// D12) are deliberately NOT here, so the dashboard and the cached hero memo stay
// perfectly consistent and nothing un-built is previewed as if real.
//
// Everything is a pure function: no IO, no Date.now, no globals. The page imports
// the JSON and passes it in, which also makes the layer trivially testable.

import type { CanonicalUsageEvent, ModelTier, Source, ValueTag } from "../types";
import {
  computeBudgetLine,
  summarizeBudgetLines,
  type BudgetLine,
} from "./budget";
import { deriveForecast, type Forecast, type PeriodContext } from "./forecast";

/** A model row in the dataset's lookup (carries tier, which events do not). */
export interface NorthstarModel {
  provider: string;
  model: string;
  tier: ModelTier;
}

/** Dataset envelope written by data/generate-northstar.mjs. */
export interface NorthstarMeta {
  org: string;
  period: string;
  period_label: string;
  period_status: string;
  currency: string;
  source: Source;
  label: string;
  note: string;
  generated_by: string;
  row_count: number;
}

/**
 * One budget row in the dataset (B3, D13). Budgets are modeled in the data so
 * the sample is reproducible; for the synthetic Northstar set they are
 * illustrative monthly department budgets, labeled and pending confirmation.
 */
export interface Budget {
  /** Which dimension this budget applies to (team / workflow / model / ...). */
  dimension: string;
  /** The key within the dimension (e.g. the department name). */
  key: string;
  amount_usd: number;
}

export interface NorthstarDataset {
  meta: NorthstarMeta;
  models: NorthstarModel[];
  events: CanonicalUsageEvent[];
  /** Monthly budgets by dimension (B3). Optional: a dataset may carry none. */
  budgets?: Budget[];
}

/** A labeled slice of spend with its share (0..1) of the total. */
export interface SpendSlice {
  key: string;
  value: number;
  share: number;
}

export interface ModelSpend extends SpendSlice {
  provider: string;
  model: string;
  tier: ModelTier;
}

export interface CostDriver {
  rank: number;
  team: string;
  workflow: string;
  label: string;
  value: number;
  share: number;
}

export interface DailyPoint {
  date: string;
  value: number;
}

export interface DashboardAggregates {
  org: string;
  periodLabel: string;
  source: Source;
  currency: string;
  totalSpend: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  eventCount: number;
  activeDays: number;
  costPerRequest: number;
  byTeam: SpendSlice[];
  byProvider: SpendSlice[];
  byTier: SpendSlice[];
  byValueTag: SpendSlice[];
  byEnvironment: SpendSlice[];
  byApproval: SpendSlice[];
  byModel: ModelSpend[];
  topDrivers: CostDriver[];
  dailyTrend: DailyPoint[];
  lowValueSpend: number;
  unapprovedSpend: number;
  missingOwnerSpend: number;
  frontierSpend: number;
  frontierLowValueSpend: number;
}

const TIER_ORDER: ModelTier[] = ["frontier", "mid", "cheap"];
const VALUE_ORDER: ValueTag[] = ["high", "medium", "low"];

function sumBy(
  events: CanonicalUsageEvent[],
  keyOf: (e: CanonicalUsageEvent) => string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    const k = keyOf(e);
    m.set(k, (m.get(k) ?? 0) + e.cost_usd);
  }
  return m;
}

function toSlicesDesc(map: Map<string, number>, total: number): SpendSlice[] {
  return [...map.entries()]
    .map(([key, value]) => ({ key, value, share: total === 0 ? 0 : value / total }))
    .sort((a, b) => b.value - a.value);
}

function toSlicesOrdered(
  map: Map<string, number>,
  order: string[],
  total: number,
): SpendSlice[] {
  return order
    .filter((key) => map.has(key))
    .map((key) => ({
      key,
      value: map.get(key) ?? 0,
      share: total === 0 ? 0 : (map.get(key) ?? 0) / total,
    }));
}

/** The single deterministic pass that every display number derives from. */
export function computeAggregates(dataset: NorthstarDataset): DashboardAggregates {
  const { events, models, meta } = dataset;
  const tierOf = new Map(models.map((m) => [m.model, m.tier] as const));
  const tier = (e: CanonicalUsageEvent): ModelTier => tierOf.get(e.model) ?? "mid";

  const totalSpend = events.reduce((s, e) => s + e.cost_usd, 0);
  const totalRequests = events.reduce((s, e) => s + e.requests, 0);
  const totalInputTokens = events.reduce((s, e) => s + e.input_tokens, 0);
  const totalOutputTokens = events.reduce((s, e) => s + e.output_tokens, 0);

  const sumWhere = (pred: (e: CanonicalUsageEvent) => boolean) =>
    events.reduce((s, e) => (pred(e) ? s + e.cost_usd : s), 0);

  const byModelMap = sumBy(events, (e) => e.model);
  const byModel: ModelSpend[] = [...byModelMap.entries()]
    .map(([model, value]) => {
      const info = models.find((m) => m.model === model);
      return {
        key: model,
        model,
        provider: info?.provider ?? "unknown",
        tier: info?.tier ?? "mid",
        value,
        share: totalSpend === 0 ? 0 : value / totalSpend,
      };
    })
    .sort((a, b) => b.value - a.value);

  // Key the driver map by a JSON tuple so team/workflow names (which contain
  // spaces) round-trip safely.
  const driverMap = sumBy(events, (e) => JSON.stringify([e.team, e.workflow]));
  const topDrivers: CostDriver[] = [...driverMap.entries()]
    .map(([combined, value]) => {
      const [team, workflow] = JSON.parse(combined) as [string, string];
      return { team, workflow, value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((d, i) => ({
      rank: i + 1,
      team: d.team,
      workflow: d.workflow,
      label: `${d.team} / ${d.workflow}`,
      value: d.value,
      share: totalSpend === 0 ? 0 : d.value / totalSpend,
    }));

  const dailyMap = sumBy(events, (e) => e.date);
  const dailyTrend: DailyPoint[] = [...dailyMap.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    org: meta.org,
    periodLabel: meta.period_label,
    source: meta.source,
    currency: meta.currency,
    totalSpend,
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    eventCount: events.length,
    activeDays: dailyMap.size,
    costPerRequest: totalRequests === 0 ? 0 : totalSpend / totalRequests,
    byTeam: toSlicesDesc(sumBy(events, (e) => e.team), totalSpend),
    byProvider: toSlicesDesc(sumBy(events, (e) => e.provider), totalSpend),
    byTier: toSlicesOrdered(sumBy(events, tier), TIER_ORDER, totalSpend),
    byValueTag: toSlicesOrdered(sumBy(events, (e) => e.value_tag), VALUE_ORDER, totalSpend),
    byEnvironment: toSlicesDesc(sumBy(events, (e) => e.environment), totalSpend),
    byApproval: toSlicesDesc(sumBy(events, (e) => e.approval_status), totalSpend),
    byModel,
    topDrivers,
    dailyTrend,
    lowValueSpend: sumWhere((e) => e.value_tag === "low"),
    unapprovedSpend: sumWhere((e) => e.approval_status === "unapproved"),
    missingOwnerSpend: sumWhere((e) => e.project === null),
    frontierSpend: sumWhere((e) => tier(e) === "frontier"),
    frontierLowValueSpend: sumWhere((e) => tier(e) === "frontier" && e.value_tag === "low"),
  };
}

// --- budget vs actual + forecast (B3) ----------------------------------------
//
// The pure math lives in budget.ts and forecast.ts. These two functions are the
// dataset glue: they pull the per-dimension actuals, the daily series, and the
// low-value total out of the canonical events and feed the pure functions. The
// dashboard calls these; it never recomputes.

export interface BudgetReport {
  /** Dimension the budgets are grouped on (team by default). */
  dimension: string;
  /** One line per key, sorted by actual spend descending. */
  lines: BudgetLine[];
  /** The rolled-up org line (its own status, not an average of the parts). */
  total: BudgetLine;
}

/** How each budget dimension keys a canonical event. */
const DIMENSION_KEY: Record<string, (e: CanonicalUsageEvent) => string> = {
  team: (e) => e.team,
  workflow: (e) => `${e.team} / ${e.workflow}`,
  model: (e) => e.model,
  project: (e) => e.project ?? "Unassigned",
  environment: (e) => e.environment,
};

/**
 * Build the budget-vs-actual report for a dimension (default "team"). Every key
 * with a budget OR with spend gets a line, so no spend is hidden and an
 * unbudgeted key reads "no budget set" rather than a false overrun (D13).
 */
export function buildBudgetReport(
  dataset: NorthstarDataset,
  ctx: PeriodContext,
  dimension = "team",
): BudgetReport {
  const keyOf = DIMENSION_KEY[dimension] ?? DIMENSION_KEY.team;
  const budgetByKey = new Map(
    (dataset.budgets ?? [])
      .filter((b) => b.dimension === dimension)
      .map((b) => [b.key, b.amount_usd] as const),
  );
  const actualByKey = sumBy(dataset.events, keyOf);

  const keys = new Set<string>([...budgetByKey.keys(), ...actualByKey.keys()]);
  const lines = [...keys]
    .map((key) =>
      computeBudgetLine({
        key,
        budget: budgetByKey.get(key) ?? null,
        actualToDate: actualByKey.get(key) ?? 0,
        ctx,
      }),
    )
    .sort((a, b) => b.actual - a.actual);

  return { dimension, lines, total: summarizeBudgetLines(lines, ctx) };
}

/** Build the org-level forecast / scenarios for a period from the events. */
export function buildOutlook(
  dataset: NorthstarDataset,
  ctx: PeriodContext,
): Forecast {
  const events = dataset.events;
  const actualToDate = events.reduce((s, e) => s + e.cost_usd, 0);
  const lowValueToDate = events.reduce(
    (s, e) => (e.value_tag === "low" ? s + e.cost_usd : s),
    0,
  );
  const dailyMap = sumBy(events, (e) => e.date);
  const daily = [...dailyMap.entries()].map(([date, value]) => ({ date, value }));
  return deriveForecast({ actualToDate, daily, lowValueToDate, ctx });
}

// --- presentation helpers (display-only; numbers come from above) ------------

/**
 * Strip em and en dashes from product-facing text deterministically (house
 * rule). They become a comma-space, matching the house substitution. Applied on
 * render so a stray dash in content can never reach the screen.
 */
export function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

export function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUSDWhole(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(share: number, digits = 1): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** Compact token counts for KPI chips: 1.4M, 932K. */
export function formatCompact(value: number): string {
  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
