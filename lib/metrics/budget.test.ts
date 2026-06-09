import { describe, it, expect } from "vitest";
import {
  computeBudgetLine,
  summarizeBudgetLines,
  type BudgetLine,
} from "./budget";
import { periodContext, type PeriodContext } from "./forecast";
import { buildBudgetReport, type NorthstarDataset } from "./aggregate";
import northstar from "../../data/northstar.json";

// B3 rung-2: budget variance is pure math, proven here against hand-computed
// expectations (the D13 guards especially), plus a documented hand-check that
// the report reconciles against the real Northstar sample totals.

const closedMay: PeriodContext = {
  period: "2026-05",
  daysInMonth: 31,
  daysElapsed: 31,
  daysRemaining: 0,
  status: "closed",
  basis: "calendar",
};

describe("computeBudgetLine (closed month = final variance)", () => {
  it("flags an over-budget line as overrun with the final variance", () => {
    const line = computeBudgetLine({ key: "Data Science", budget: 2000, actualToDate: 2607.44, ctx: closedMay });
    expect(line.pace).toBe(1);
    expect(line.expected).toBe(2000); // budget * pace(1)
    expect(line.varianceToDate).toBeCloseTo(607.44, 6);
    expect(line.projected).toBe(2607.44); // closed -> actual
    expect(line.projectedVariance).toBeCloseTo(607.44, 6);
    expect(line.usedPct).toBeCloseTo(2607.44 / 2000, 9);
    expect(line.status).toBe("overrun");
  });

  it("reads a line that lands just under budget as at-risk", () => {
    const line = computeBudgetLine({ key: "Engineering", budget: 1600, actualToDate: 1574.58, ctx: closedMay });
    expect(line.varianceToDate).toBeCloseTo(-25.42, 6); // under budget
    expect(line.status).toBe("at-risk"); // 98.4% used
  });

  it("reads a comfortably-under line as healthy", () => {
    const line = computeBudgetLine({ key: "Finance", budget: 250, actualToDate: 147.15, ctx: closedMay });
    expect(line.status).toBe("healthy"); // 58.9%
  });
});

describe("D13 guards (false overruns are impossible)", () => {
  it("never reports an overrun when no budget is set", () => {
    const line = computeBudgetLine({ key: "Unbudgeted", budget: null, actualToDate: 5000, ctx: closedMay });
    expect(line.status).toBe("no-budget");
    expect(line.budget).toBeNull();
    expect(line.expected).toBeNull();
    expect(line.varianceToDate).toBeNull();
    expect(line.projectedVariance).toBeNull();
    expect(line.actual).toBe(5000); // the actual is still surfaced
  });

  it("never reports an overrun in an early open month, even when far ahead", () => {
    const early: PeriodContext = { ...closedMay, daysElapsed: 2, daysRemaining: 29, status: "open" };
    const line = computeBudgetLine({ key: "Spiky", budget: 100, actualToDate: 300, ctx: early });
    // run-rate would project a huge overrun, but the guard wins
    expect(line.projectedUsedPct).toBeGreaterThan(1);
    expect(line.status).toBe("early");
  });

  it("judges an open month on its projection, not its actual to date", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 10, daysRemaining: 21, status: "open" };
    const line = computeBudgetLine({ key: "Pacey", budget: 1000, actualToDate: 500, ctx });
    expect(line.usedPct).toBeCloseTo(0.5, 9); // only half spent...
    expect(line.projected).toBeCloseTo(1550, 6); // ...but projected to 155%
    expect(line.status).toBe("overrun");
  });
});

describe("summarizeBudgetLines", () => {
  it("rolls lines into a total with its own status", () => {
    const lines: BudgetLine[] = [
      computeBudgetLine({ key: "A", budget: 2000, actualToDate: 2607.44, ctx: closedMay }),
      computeBudgetLine({ key: "B", budget: 1600, actualToDate: 1574.58, ctx: closedMay }),
    ];
    const total = summarizeBudgetLines(lines, closedMay);
    expect(total.budget).toBe(3600);
    expect(total.actual).toBeCloseTo(4182.02, 6);
    expect(total.status).toBe("overrun"); // 116% used
  });
});

describe("buildBudgetReport reconciles with the Northstar sample (hand-check)", () => {
  const dataset = northstar as unknown as NorthstarDataset;
  const ctx = periodContext(dataset.meta);
  const report = buildBudgetReport(dataset, ctx);
  const line = (key: string) => report.lines.find((l) => l.key === key)!;

  it("paces a closed sample month to 1", () => {
    expect(ctx.status).toBe("closed");
    expect(report.lines[0].pace).toBe(1);
  });

  it("matches the hand-computed department variances", () => {
    // budgets: DS 2000, Eng 1600, Mkt 700, Prod 600, CS 500, Fin 250, Sales 150
    expect(line("Data Science").actual).toBeCloseTo(2607.44, 6);
    expect(line("Data Science").varianceToDate).toBeCloseTo(607.44, 6);
    expect(line("Data Science").status).toBe("overrun");

    expect(line("Marketing").varianceToDate).toBeCloseTo(281.45, 6);
    expect(line("Marketing").status).toBe("overrun");

    expect(line("Engineering").varianceToDate).toBeCloseTo(-25.42, 6);
    expect(line("Engineering").status).toBe("at-risk");

    expect(line("Finance").status).toBe("healthy");
    expect(line("Sales").status).toBe("healthy");
  });

  it("orders lines by actual spend descending", () => {
    expect(report.lines[0].key).toBe("Data Science");
    const actuals = report.lines.map((l) => l.actual);
    expect([...actuals].sort((a, b) => b - a)).toEqual(actuals);
  });

  it("rolls up the org total to a $460.10 overrun", () => {
    expect(report.total.budget).toBe(5800);
    expect(report.total.actual).toBeCloseTo(6260.1, 6);
    expect(report.total.varianceToDate).toBeCloseTo(460.1, 6);
    expect(report.total.status).toBe("overrun");
  });

  it("never invents an overrun for an unbudgeted dimension", () => {
    // there are no workflow budgets, so every workflow line reads no-budget
    const byWorkflow = buildBudgetReport(dataset, ctx, "workflow");
    expect(byWorkflow.lines.length).toBeGreaterThan(0);
    expect(byWorkflow.lines.every((l) => l.status === "no-budget")).toBe(true);
    expect(byWorkflow.lines.some((l) => l.status === "overrun")).toBe(false);
  });
});
