// Deterministic budget variance (B3, D13 / DISCOVERY section 7).
//
// Architectural law (CLAUDE.md, DISCOVERY section 4): code computes every number.
// This module turns a budget and an actual into pace, expected-to-date,
// variance, a run-rate projection, and a status. Pure functions only; the date
// enters through the PeriodContext the caller built (see forecast.ts), never
// from the clock here.
//
// D13 honesty guards, enforced in code (this is why status is not a naive
// actual/budget compare):
//   - No budget set: status "no-budget", the actual is still shown, and it is
//     NEVER reported as an overrun (a false overrun would undercut credibility).
//   - Early month (< EARLY_DAYS elapsed): status "early", never an overrun; the
//     run-rate is too noisy to call.
//   - Otherwise status is decided on the PROJECTED used-fraction, so an open
//     month is judged on where it is heading, not only on what it has spent.
//   - A closed month projects to its actual, so status is the final variance.

import {
  pace,
  runRateProjection,
  type PeriodContext,
} from "./forecast";

export type BudgetStatus =
  | "healthy"
  | "at-risk"
  | "overrun"
  | "no-budget"
  | "early";

/** projected/budget at or above this (but at/below overrun) reads "at risk". */
export const AT_RISK_FLOOR = 0.9;
/** projected/budget above this reads "overrun" (projected past the budget). */
export const OVERRUN_FLOOR = 1.0;

/** One budget-vs-actual line for a dimension key (a department, a workflow, ...). */
export interface BudgetLine {
  key: string;
  /** The monthly budget, or null when none is set for this key. */
  budget: number | null;
  /** Spend so far this period. */
  actual: number;
  /** Fraction of the period elapsed (D13 pacing). */
  pace: number;
  /** budget * pace, or null with no budget. */
  expected: number | null;
  /** actual - expected (positive = ahead of pace), or null with no budget. */
  varianceToDate: number | null;
  /** Run-rate projection for the full period (= actual when closed). */
  projected: number;
  /** projected - budget (positive = projected overrun), or null with no budget. */
  projectedVariance: number | null;
  /** actual / budget, or null with no budget. */
  usedPct: number | null;
  /** projected / budget, or null with no budget. */
  projectedUsedPct: number | null;
  status: BudgetStatus;
}

export interface BudgetLineInput {
  key: string;
  budget: number | null;
  actualToDate: number;
  ctx: PeriodContext;
}

/** Decide status in code (not by AI), honoring the D13 guards. */
function statusFor(
  budget: number | null,
  projectedUsedPct: number | null,
  ctx: PeriodContext,
): BudgetStatus {
  if (budget === null || budget <= 0) return "no-budget";
  if (ctx.status === "open" && ctx.daysElapsed < 3) return "early";
  if (projectedUsedPct === null) return "no-budget";
  if (projectedUsedPct > OVERRUN_FLOOR) return "overrun";
  if (projectedUsedPct >= AT_RISK_FLOOR) return "at-risk";
  return "healthy";
}

/** Compute one budget line. The projection is the run-rate (forecast.ts). */
export function computeBudgetLine(input: BudgetLineInput): BudgetLine {
  const { key, budget, actualToDate, ctx } = input;
  const p = pace(ctx);
  const projected = runRateProjection(actualToDate, ctx);

  const hasBudget = budget !== null && budget > 0;
  const expected = hasBudget ? budget * p : null;
  const varianceToDate = expected === null ? null : actualToDate - expected;
  const projectedVariance = hasBudget ? projected - budget : null;
  const usedPct = hasBudget ? actualToDate / budget : null;
  const projectedUsedPct = hasBudget ? projected / budget : null;

  return {
    key,
    budget,
    actual: actualToDate,
    pace: p,
    expected,
    varianceToDate,
    projected,
    projectedVariance,
    usedPct,
    projectedUsedPct,
    status: statusFor(budget, projectedUsedPct, ctx),
  };
}

/**
 * Roll a set of lines into one total line (org level). The total budget is the
 * sum of the set budgets; the status is recomputed on the totals so the org gets
 * its own honest verdict rather than an average of the parts.
 */
export function summarizeBudgetLines(
  lines: BudgetLine[],
  ctx: PeriodContext,
): BudgetLine {
  const totalBudget = lines.reduce((s, l) => s + (l.budget ?? 0), 0);
  const totalActual = lines.reduce((s, l) => s + l.actual, 0);
  return computeBudgetLine({
    key: "Total",
    budget: totalBudget > 0 ? totalBudget : null,
    actualToDate: totalActual,
    ctx,
  });
}
