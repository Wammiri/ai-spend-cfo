// Deterministic forecasting (B3, D13 / DISCOVERY section 7).
//
// Architectural law (CLAUDE.md, DISCOVERY section 4): code computes every number;
// the AI never calculates. This module produces run-rate, recent-trend, and
// scenario projections from already-aggregated spend. The memo and the dashboard
// consume the output; they never recompute.
//
// Pure functions only: no IO, no Date.now, no globals. The current date enters
// the layer exactly once, as an explicit `asOf` argument the caller supplies
// (the closed Northstar sample never needs it). That keeps every projection
// reproducible and trivially testable.
//
// D13 guards (the honesty stance, why this module is careful):
//   - Calendar-day pacing by default; business-day pacing is a one-line switch
//     (DEFAULT_PACING_BASIS), never the default.
//   - If fewer than EARLY_DAYS days have elapsed, a projection is labeled
//     "early / low confidence", never reported as an overrun.
//   - A closed month is realized, so its run-rate projection equals its actual.

/** Pacing basis for expected-to-date (D13). Calendar is the default. */
export type PacingBasis = "calendar" | "business";

/** D13 one-line switch: business-day pacing is available but off by default. */
export const DEFAULT_PACING_BASIS: PacingBasis = "calendar";

/** Below this many elapsed days, a projection is "early / low confidence" (D13). */
export const EARLY_DAYS = 3;

/** Scenario assumptions, kept as named constants so the math is auditable. */
export const UPSIDE_GROWTH = 0.25; // upside: +25% usage
export const CONTROL_LOW_VALUE_CUT = 0.3; // control: low-value workflows down 30%

/**
 * The time position of a period: how many days have elapsed of how many, and
 * whether the month is closed. Derived once by `periodContext`; every pure
 * function below takes this so none of them reads the clock.
 */
export interface PeriodContext {
  /** Period key, ISO "YYYY-MM". */
  period: string;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  status: "open" | "closed";
  basis: PacingBasis;
}

/**
 * Build a PeriodContext from a dataset's meta. A closed month is fully elapsed.
 * For an open month the caller supplies `asOf` (the live/upload path); with no
 * `asOf` an open month falls back to fully elapsed, so this function never reads
 * the clock and stays deterministic.
 */
export function periodContext(
  meta: { period: string; period_status: string },
  asOf?: Date,
  basis: PacingBasis = DEFAULT_PACING_BASIS,
): PeriodContext {
  const [year, monthNum] = meta.period.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const status: "open" | "closed" =
    meta.period_status === "open" ? "open" : "closed";

  let daysElapsed: number;
  if (status === "closed" || !asOf) {
    daysElapsed = daysInMonth;
  } else {
    const refYear = asOf.getUTCFullYear();
    const refMonth = asOf.getUTCMonth(); // 0-based
    const target = monthNum - 1;
    if (refYear < year || (refYear === year && refMonth < target)) {
      daysElapsed = 0; // asOf precedes the period
    } else if (refYear > year || (refYear === year && refMonth > target)) {
      daysElapsed = daysInMonth; // asOf is past the period
    } else {
      daysElapsed = Math.min(asOf.getUTCDate(), daysInMonth);
    }
  }

  return {
    period: meta.period,
    daysInMonth,
    daysElapsed,
    daysRemaining: Math.max(0, daysInMonth - daysElapsed),
    status,
    basis,
  };
}

/** Count weekdays (Mon-Fri) from day `from` to day `to` of the period. */
function businessDays(period: string, from: number, to: number): number {
  const [year, monthNum] = period.split("-").map(Number);
  let n = 0;
  for (let d = from; d <= to; d++) {
    const dow = new Date(Date.UTC(year, monthNum - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/**
 * Fraction of the period elapsed (D13). Calendar by default; business-day pacing
 * when the context's basis is "business". A closed month always paces to 1.
 */
export function pace(ctx: PeriodContext): number {
  if (ctx.daysInMonth === 0) return 0;
  if (ctx.basis === "business") {
    const elapsed = businessDays(ctx.period, 1, ctx.daysElapsed);
    const total = businessDays(ctx.period, 1, ctx.daysInMonth);
    return total === 0 ? 0 : elapsed / total;
  }
  return ctx.daysElapsed / ctx.daysInMonth;
}

/**
 * Run-rate projection (DISCOVERY section 7): average daily spend to date,
 * extended over the whole month. For a closed month this equals the actual.
 */
export function runRateProjection(actualToDate: number, ctx: PeriodContext): number {
  if (ctx.status === "closed") return actualToDate; // realized; avoid FP drift
  if (ctx.daysElapsed <= 0) return 0;
  return (actualToDate / ctx.daysElapsed) * ctx.daysInMonth;
}

/** A single projection label tells the reader how much to trust the number (D13). */
export type Confidence = "early" | "projected" | "closed";

export function confidenceFor(ctx: PeriodContext): Confidence {
  if (ctx.status === "closed") return "closed";
  if (ctx.daysElapsed < EARLY_DAYS) return "early";
  return "projected";
}

/** One forward scenario for the period (month-end projection). */
export interface Scenario {
  key: "base" | "upside" | "control";
  label: string;
  amount: number;
}

export interface Forecast {
  /** Spend so far (input echoed for the view). */
  actualToDate: number;
  /** avg_daily_to_date * days_in_month. */
  runRate: number;
  /** avg_daily_last_7d * days_remaining + actual_to_date. */
  recentTrend: number;
  /** The projection used downstream for budget status (the run-rate). */
  projected: number;
  scenarios: Scenario[];
  /** Savings of the control scenario vs base (run-rate), always >= 0. */
  controlSavings: number;
  confidence: Confidence;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
}

export interface ForecastInput {
  actualToDate: number;
  /** Daily spend totals (any order); used for the recent-trend window. */
  daily: { date: string; value: number }[];
  /** Low-value spend to date; drives the control scenario. */
  lowValueToDate: number;
  ctx: PeriodContext;
}

/**
 * Average daily spend over the trailing 7 active days (by date). With fewer than
 * 7 days of data, it averages what exists. Returns 0 when there is no data.
 */
function recentDailyAverage(daily: { date: string; value: number }[]): number {
  if (daily.length === 0) return 0;
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-7);
  const sum = window.reduce((s, d) => s + d.value, 0);
  return sum / window.length;
}

/** Build all projections for a period from already-aggregated inputs. */
export function deriveForecast(input: ForecastInput): Forecast {
  const { actualToDate, daily, lowValueToDate, ctx } = input;

  const runRate = runRateProjection(actualToDate, ctx);
  const lowValueRunRate = runRateProjection(lowValueToDate, ctx);
  const recentTrend =
    actualToDate + recentDailyAverage(daily) * ctx.daysRemaining;

  const base = runRate;
  const upside = runRate * (1 + UPSIDE_GROWTH);
  const control = runRate - CONTROL_LOW_VALUE_CUT * lowValueRunRate;

  return {
    actualToDate,
    runRate,
    recentTrend,
    projected: runRate,
    scenarios: [
      { key: "base", label: "Base (current run-rate)", amount: base },
      { key: "upside", label: "Upside (+25% usage)", amount: upside },
      {
        key: "control",
        label: "Control (low-value workflows down 30%)",
        amount: control,
      },
    ],
    controlSavings: Math.max(0, base - control),
    confidence: confidenceFor(ctx),
    daysElapsed: ctx.daysElapsed,
    daysInMonth: ctx.daysInMonth,
    daysRemaining: ctx.daysRemaining,
  };
}
