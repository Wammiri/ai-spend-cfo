import { describe, it, expect } from "vitest";
import type { CanonicalUsageEvent } from "../types";
import {
  computeAggregates,
  formatPercent,
  formatUSD,
  stripEmDashes,
  type NorthstarDataset,
} from "./aggregate";
import northstar from "../../data/northstar.json";
import memo from "../../data/precomputed-memo.json";

// Two layers of proof for B1:
//   1. The pure aggregation functions are correct on a tiny hand-checkable fixture.
//   2. The cached hero memo's figures reconcile with the aggregates computed from
//      the real Northstar dataset. This is a B1 precursor to control C2 (memo
//      number integrity): no headline figure in the committed memo may drift from
//      what the deterministic layer computes.

function ev(partial: Partial<CanonicalUsageEvent>): CanonicalUsageEvent {
  return {
    date: "2026-05-01",
    actor: "a",
    team: "Team A",
    workflow: "Flow A",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    input_tokens: 0,
    output_tokens: 0,
    requests: 1,
    cost_usd: 0,
    value_tag: "medium",
    approval_status: "approved",
    environment: "prod",
    project: "P",
    source: "synthetic",
    ...partial,
  };
}

const fixture: NorthstarDataset = {
  meta: {
    org: "Fixture",
    period: "2026-05",
    period_label: "May 2026",
    period_status: "closed",
    currency: "USD",
    source: "synthetic",
    label: "Sample data",
    note: "",
    generated_by: "test",
    row_count: 4,
  },
  models: [
    { provider: "anthropic", model: "claude-opus-4-8", tier: "frontier" },
    { provider: "anthropic", model: "claude-sonnet-4-6", tier: "mid" },
    { provider: "anthropic", model: "claude-haiku-4-5", tier: "cheap" },
  ],
  events: [
    ev({ date: "2026-05-01", team: "Eng", workflow: "Build", model: "claude-opus-4-8", cost_usd: 100, value_tag: "low", requests: 10, approval_status: "unapproved" }),
    ev({ date: "2026-05-01", team: "Eng", workflow: "Build", model: "claude-sonnet-4-6", cost_usd: 50, value_tag: "high", requests: 5 }),
    ev({ date: "2026-05-02", team: "Sales", workflow: "Reach", model: "claude-haiku-4-5", cost_usd: 30, value_tag: "low", requests: 15, project: null }),
    ev({ date: "2026-05-02", team: "Sales", workflow: "Reach", model: "claude-opus-4-8", cost_usd: 20, value_tag: "medium", requests: 2, project: null }),
  ],
};

describe("computeAggregates (fixture)", () => {
  const agg = computeAggregates(fixture);

  it("totals spend, requests, and cost per request", () => {
    expect(agg.totalSpend).toBe(200);
    expect(agg.totalRequests).toBe(32);
    expect(agg.costPerRequest).toBeCloseTo(200 / 32, 6);
  });

  it("groups by team in descending order with shares", () => {
    expect(agg.byTeam.map((s) => s.key)).toEqual(["Eng", "Sales"]);
    expect(agg.byTeam[0].value).toBe(150);
    expect(agg.byTeam[0].share).toBeCloseTo(0.75, 6);
  });

  it("orders tier and value-tag slices canonically", () => {
    expect(agg.byTier.map((s) => s.key)).toEqual(["frontier", "mid", "cheap"]);
    // opus(100) + opus(20) = 120 frontier; sonnet 50 mid; haiku 30 cheap
    expect(agg.byTier[0].value).toBe(120);
    expect(agg.byValueTag.map((s) => s.key)).toEqual(["high", "medium", "low"]);
  });

  it("rolls up the waste indicators", () => {
    expect(agg.lowValueSpend).toBe(130); // 100 + 30
    expect(agg.unapprovedSpend).toBe(100);
    expect(agg.missingOwnerSpend).toBe(50); // both Sales rows
    expect(agg.frontierSpend).toBe(120);
    expect(agg.frontierLowValueSpend).toBe(100); // opus + low value
  });

  it("ranks cost drivers and keeps multi-word team/workflow names intact", () => {
    expect(agg.topDrivers[0]).toMatchObject({ rank: 1, team: "Eng", workflow: "Build", value: 150 });
    expect(agg.topDrivers[1]).toMatchObject({ team: "Sales", workflow: "Reach", value: 50 });
  });

  it("builds a sorted daily trend", () => {
    expect(agg.dailyTrend).toEqual([
      { date: "2026-05-01", value: 150 },
      { date: "2026-05-02", value: 50 },
    ]);
  });
});

describe("Northstar dataset is honestly labeled", () => {
  it("is synthetic on every row and in its meta", () => {
    const ds = northstar as unknown as NorthstarDataset;
    expect(ds.meta.source).toBe("synthetic");
    expect(ds.meta.label).toBe("Sample data");
    expect(ds.events.every((e) => e.source === "synthetic")).toBe(true);
    expect(ds.events.length).toBe(ds.meta.row_count);
  });
});

describe("cached memo reconciles with computed aggregates (C2 precursor)", () => {
  const agg = computeAggregates(northstar as unknown as NorthstarDataset);
  const f = memo.figures;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const teamSpend = (name: string) =>
    agg.byTeam.find((s) => s.key === name)?.value ?? 0;
  const driverSpend = (team: string, workflow: string) => {
    // sum every event in this team+workflow (top-6 list may not include it)
    const ds = northstar as unknown as NorthstarDataset;
    return ds.events
      .filter((e) => e.team === team && e.workflow === workflow)
      .reduce((s, e) => s + e.cost_usd, 0);
  };

  it("matches the top-line totals", () => {
    expect(round2(agg.totalSpend)).toBe(f.total_spend);
    expect(agg.totalRequests).toBe(f.total_requests);
  });

  it("matches every dollar-backed flag", () => {
    expect(round2(agg.frontierSpend)).toBe(f.frontier_spend);
    expect(round2(agg.lowValueSpend)).toBe(f.low_value_spend);
    expect(round2(agg.unapprovedSpend)).toBe(f.unapproved_spend);
    expect(round2(agg.missingOwnerSpend)).toBe(f.missing_owner_spend);
    expect(round2(agg.frontierLowValueSpend)).toBe(f.frontier_low_value_spend);
  });

  it("matches the per-team figures cited in the memo", () => {
    expect(round2(teamSpend("Data Science"))).toBe(f.data_science_spend);
    expect(round2(teamSpend("Engineering"))).toBe(f.engineering_spend);
    expect(round2(teamSpend("Marketing"))).toBe(f.marketing_spend);
    expect(round2(teamSpend("Finance"))).toBe(f.finance_spend);
  });

  it("matches the combined top-two Data Science workflow figure", () => {
    const combined =
      driverSpend("Data Science", "Model evaluation harness") +
      driverSpend("Data Science", "Synthetic data generation");
    expect(round2(combined)).toBe(f.top_two_ds_workflows);
  });

  it("carries the in-code needs-review honesty stance", () => {
    expect(memo.needs_review.length).toBeGreaterThan(0);
    expect(memo.needs_review_note).toMatch(/needs review/i);
  });
});

describe("presentation helpers", () => {
  it("formats currency and percent", () => {
    expect(formatUSD(6260.1)).toBe("$6,260.10");
    expect(formatPercent(0.792)).toBe("79.2%");
  });

  it("strips em and en dashes deterministically (house rule)", () => {
    expect(stripEmDashes("spend, then governance")).toBe("spend, then governance");
    expect(stripEmDashes("a — b")).toBe("a, b");
    expect(stripEmDashes("2024–2026")).toBe("2024, 2026");
  });
});
