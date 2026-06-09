import { describe, it, expect } from "vitest";
import {
  confidenceFor,
  deriveForecast,
  pace,
  periodContext,
  runRateProjection,
  type PeriodContext,
} from "./forecast";

// B3 rung-2: the forecast engine is pure math, so it is proven here against
// hand-computed expectations, including the D13 guards (early / low confidence,
// closed-month realization). No browser is driven for pure math.

const closedMay: PeriodContext = {
  period: "2026-05",
  daysInMonth: 31,
  daysElapsed: 31,
  daysRemaining: 0,
  status: "closed",
  basis: "calendar",
};

describe("periodContext", () => {
  it("treats a closed month as fully elapsed (pace 1)", () => {
    const ctx = periodContext({ period: "2026-05", period_status: "closed" });
    expect(ctx.daysInMonth).toBe(31);
    expect(ctx.daysElapsed).toBe(31);
    expect(ctx.daysRemaining).toBe(0);
    expect(ctx.status).toBe("closed");
    expect(pace(ctx)).toBe(1);
  });

  it("derives elapsed days from asOf for an open month", () => {
    const ctx = periodContext(
      { period: "2026-05", period_status: "open" },
      new Date(Date.UTC(2026, 4, 10)), // May 10
    );
    expect(ctx.daysElapsed).toBe(10);
    expect(ctx.daysRemaining).toBe(21);
    expect(ctx.status).toBe("open");
    expect(pace(ctx)).toBeCloseTo(10 / 31, 9);
  });

  it("clamps asOf before / after the period", () => {
    const before = periodContext(
      { period: "2026-05", period_status: "open" },
      new Date(Date.UTC(2026, 3, 15)), // April
    );
    const after = periodContext(
      { period: "2026-05", period_status: "open" },
      new Date(Date.UTC(2026, 6, 1)), // July
    );
    expect(before.daysElapsed).toBe(0);
    expect(after.daysElapsed).toBe(31);
  });

  it("computes days in a 30-day and a 28-day month", () => {
    expect(periodContext({ period: "2026-04", period_status: "closed" }).daysInMonth).toBe(30);
    expect(periodContext({ period: "2026-02", period_status: "closed" }).daysInMonth).toBe(28);
  });
});

describe("pace (D13 calendar default, business-day switch)", () => {
  // Independent oracle for weekday counting (does not reuse the module's code).
  const weekdays = (year: number, month1: number, from: number, to: number) => {
    let n = 0;
    for (let d = from; d <= to; d++) {
      const dow = new Date(Date.UTC(year, month1 - 1, d)).getUTCDay();
      if (dow !== 0 && dow !== 6) n++;
    }
    return n;
  };

  it("calendar pace is elapsed / total days", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 10, daysRemaining: 21, status: "open" };
    expect(pace(ctx)).toBeCloseTo(10 / 31, 9);
  });

  it("business pace counts only weekdays", () => {
    const ctx: PeriodContext = {
      period: "2026-05",
      daysInMonth: 31,
      daysElapsed: 10,
      daysRemaining: 21,
      status: "open",
      basis: "business",
    };
    const expected = weekdays(2026, 5, 1, 10) / weekdays(2026, 5, 1, 31);
    expect(pace(ctx)).toBeCloseTo(expected, 9);
  });

  it("both bases pace a closed month to 1", () => {
    expect(pace(closedMay)).toBe(1);
    expect(pace({ ...closedMay, basis: "business" })).toBe(1);
  });
});

describe("runRateProjection", () => {
  it("equals the actual for a closed month (no FP drift)", () => {
    expect(runRateProjection(6260.1, closedMay)).toBe(6260.1);
  });

  it("extends the daily average over the month for an open period", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 10, daysRemaining: 21, status: "open" };
    expect(runRateProjection(500, ctx)).toBeCloseTo((500 / 10) * 31, 9);
  });

  it("is 0 with no elapsed days", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 0, daysRemaining: 31, status: "open" };
    expect(runRateProjection(500, ctx)).toBe(0);
  });
});

describe("confidenceFor (D13)", () => {
  it("labels a closed month closed", () => {
    expect(confidenceFor(closedMay)).toBe("closed");
  });
  it("labels an early open month early, never an overrun", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 2, daysRemaining: 29, status: "open" };
    expect(confidenceFor(ctx)).toBe("early");
  });
  it("labels a settled open month projected", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 12, daysRemaining: 19, status: "open" };
    expect(confidenceFor(ctx)).toBe("projected");
  });
});

describe("deriveForecast scenarios", () => {
  it("realizes a closed month and prices the control scenario", () => {
    const f = deriveForecast({
      actualToDate: 1000,
      daily: Array.from({ length: 31 }, (_, i) => ({
        date: `2026-05-${String(i + 1).padStart(2, "0")}`,
        value: 1000 / 31,
      })),
      lowValueToDate: 300,
      ctx: closedMay,
    });
    expect(f.runRate).toBe(1000);
    expect(f.recentTrend).toBeCloseTo(1000, 6); // no days remaining
    const byKey = Object.fromEntries(f.scenarios.map((s) => [s.key, s.amount]));
    expect(byKey.base).toBe(1000);
    expect(byKey.upside).toBeCloseTo(1250, 6); // +25%
    expect(byKey.control).toBeCloseTo(910, 6); // 1000 - 0.3*300
    expect(f.controlSavings).toBeCloseTo(90, 6);
    expect(f.confidence).toBe("closed");
  });

  it("projects an open month from run-rate and recent trend", () => {
    const ctx: PeriodContext = { ...closedMay, daysElapsed: 10, daysRemaining: 21, status: "open" };
    const f = deriveForecast({
      actualToDate: 500,
      daily: Array.from({ length: 10 }, (_, i) => ({
        date: `2026-05-${String(i + 1).padStart(2, "0")}`,
        value: 50,
      })),
      lowValueToDate: 100,
      ctx,
    });
    expect(f.runRate).toBeCloseTo(1550, 6); // (500/10)*31
    expect(f.recentTrend).toBeCloseTo(500 + 50 * 21, 6); // last-7 avg 50 * 21 + 500
    const control = Object.fromEntries(f.scenarios.map((s) => [s.key, s.amount])).control;
    expect(control).toBeCloseTo(1550 - 0.3 * (100 / 10) * 31, 6);
    expect(f.confidence).toBe("projected");
  });
});
