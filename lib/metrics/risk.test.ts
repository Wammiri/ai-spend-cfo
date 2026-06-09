import { describe, it, expect } from "vitest";
import type { CanonicalUsageEvent } from "../types";
import {
  computeRiskFlags,
  computeTierRepricing,
  frontierSpend,
  tierInfoFor,
  tierOf,
} from "./risk";

// B4 / D12: the quantified flags and the model-tier repricing savings are
// produced entirely by code, with hand-checkable numbers. The repricing figure
// is the new, honest "expensive-model misuse" savings (current cost minus the
// same tokens repriced at the recommended cheaper tier), which supersedes citing
// the raw frontier-on-low-value spend as the impact.

function ev(p: Partial<CanonicalUsageEvent>): CanonicalUsageEvent {
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
    ...p,
  };
}

// 1M input + 1M output tokens on Opus = 1*15 + 1*75 = $90; the same tokens on the
// recommended cheaper target (Sonnet) = 1*3 + 1*15 = $18; so repricing saves $72.
const opusLow = ev({
  model: "claude-opus-4-8",
  value_tag: "low",
  approval_status: "unapproved",
  project: null,
  input_tokens: 1_000_000,
  output_tokens: 1_000_000,
  cost_usd: 90,
});
const sonnetHigh = ev({ model: "claude-sonnet-4-6", value_tag: "high", cost_usd: 18 });
const haikuLow = ev({ model: "claude-haiku-4-5", value_tag: "low", project: "Q", date: "2026-05-02", cost_usd: 5 });

describe("model tier map (D12)", () => {
  it("maps frontier models with a cheaper target", () => {
    expect(tierOf("anthropic", "claude-opus-4-8")).toBe("frontier");
    expect(tierInfoFor("anthropic", "claude-opus-4-8")?.target).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
  });

  it("maps cheap models with no target and is case-insensitive", () => {
    expect(tierOf("ANTHROPIC", "Claude-Haiku-4-5")).toBe("cheap");
    expect(tierInfoFor("anthropic", "claude-haiku-4-5")?.target).toBeUndefined();
  });

  it("falls unmapped models to mid, never silently to frontier", () => {
    expect(tierOf("acme", "mystery-model")).toBe("mid");
    expect(tierInfoFor("acme", "mystery-model")).toBeNull();
  });
});

describe("computeTierRepricing (D12 savings)", () => {
  const r = computeTierRepricing([opusLow, sonnetHigh, haikuLow]);

  it("reprices only frontier, low-value spend that has a cheaper target", () => {
    expect(r.events).toBe(1); // only opusLow qualifies
    expect(r.consideredSpend).toBe(90);
    expect(r.repricedCost).toBe(18);
    expect(r.savings).toBe(72);
  });
});

describe("computeRiskFlags", () => {
  const flags = computeRiskFlags([opusLow, sonnetHigh, haikuLow]);
  const by = (key: string) => flags.find((f) => f.key === key);

  it("quantifies frontier misuse as the repricing savings, not the raw spend", () => {
    expect(by("frontier-misuse")?.impact_usd).toBe(72);
  });

  it("sums low-value, unapproved, and missing-owner exposure in dollars", () => {
    expect(by("low-value")?.impact_usd).toBe(95); // 90 + 5
    expect(by("unapproved")?.impact_usd).toBe(90);
    expect(by("missing-owner")?.impact_usd).toBe(90);
  });

  it("does not raise a flag with zero impact (no spike here)", () => {
    expect(by("usage-spike")).toBeUndefined();
  });

  it("every flag carries a dollar impact (credibility checklist)", () => {
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every((f) => f.impact_usd > 0)).toBe(true);
  });
});

describe("frontierSpend", () => {
  it("sums only frontier-tier spend", () => {
    expect(frontierSpend([opusLow, sonnetHigh, haikuLow])).toBe(90); // opus only
  });
});
