import { describe, it, expect } from "vitest";
import northstar from "../../data/northstar.json";
import { formatUSD, type NorthstarDataset } from "../metrics/aggregate";
import {
  assembleMemo,
  buildMemoInputs,
  collectMemoFigures,
  type MemoNarrative,
} from "./build-inputs";
import { validateMemo } from "./validate";

// B4 integration: the live memo path (build inputs -> assemble -> C2 validate)
// is honest on the REAL Northstar numbers. The memo inputs are produced by the
// deterministic layer; the supplied figure set is derived from them; a narrative
// that cites only supplied figures validates clean, and one that fabricates a
// figure is caught. This is C1 + C2 proven together on actual data, not a fixture.

const dataset = northstar as unknown as NorthstarDataset;
const inputs = buildMemoInputs(dataset);
const supplied = collectMemoFigures(inputs);

function narrative(extra: Partial<MemoNarrative> = {}): MemoNarrative {
  return {
    executive_summary: [`Total AI spend reached ${formatUSD(inputs.summary.totalSpend)} for the period.`],
    driver_comment: "Spend is led by a small number of workflows.",
    risk_comment: "The flags below quantify the avoidable spend.",
    budget_comment: "Two departments are over budget.",
    forecast_comment: "The outlook holds at the current run-rate.",
    recommendations: [{ text: "Set per-department budgets.", impact_note: "" }],
    questions: ["Can the largest low-value workflow move to a cheaper tier?"],
    data_sufficiency_comment: "Thin-data items are excluded from the recommendations.",
    ...extra,
  };
}

describe("buildMemoInputs on Northstar", () => {
  it("reconciles its summary with the known dataset totals", () => {
    expect(inputs.summary.totalSpend).toBe(6260.1);
    expect(inputs.summary.frontierSpend).toBe(4958.22);
    expect(inputs.summary.lowValueSpend).toBe(2214.23);
    expect(inputs.summary.unapprovedSpend).toBe(1593.84);
  });

  it("folds in the B3 budget report and forecast (D26)", () => {
    expect(inputs.budget).not.toBeNull();
    expect(inputs.budget?.total.status).toBe("overrun"); // org over by $460.10
    expect(inputs.forecast).not.toBeNull();
  });

  it("includes a quantified frontier-misuse savings flag (D12)", () => {
    const flag = inputs.riskFlags.find((f) => f.key === "frontier-misuse");
    expect(flag).toBeDefined();
    expect(flag!.impact_usd).toBeGreaterThan(0);
    // Repriced savings is strictly less than the frontier-on-low-value spend.
    expect(flag!.impact_usd).toBeLessThan(2214.23);
  });
});

describe("C2 on the assembled live memo (real numbers)", () => {
  it("passes a narrative that cites only supplied figures (allowed)", () => {
    const doc = assembleMemo(inputs, narrative());
    expect(validateMemo(doc, supplied).ok).toBe(true);
  });

  it("flags a narrative that fabricates a figure (forbidden)", () => {
    const doc = assembleMemo(inputs, narrative({
      executive_summary: ["A hidden cost of $987,654 was discovered."],
    }));
    const result = validateMemo(doc, supplied);
    expect(result.ok).toBe(false);
    expect(result.flagged).toContain(987654);
  });
});
