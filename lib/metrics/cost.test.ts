import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PricingRow, RawUsageRow } from "../types";
import {
  buildCanonicalEvents,
  deriveCost,
  reconcileValue,
} from "./cost";
import { parseAnthropicConsole } from "../parsers/anthropic-console";
import { parseCanonicalCsv } from "../parsers/canonical-csv";

// Cost is the canonical engine (D10): code re-derives every number, then
// reconciles against any provider-reported cost. These hand-check the formula,
// the reconciliation flag, and the full ingestion pipeline end to end on the
// bundled sample exports.

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "../../public", rel), "utf8");

const OPUS: PricingRow = { provider: "anthropic", model: "claude-opus-4-8", input_price_per_1m: 15, output_price_per_1m: 75, cached_input_price_per_1m: 1.5, effective_date: "2026-01-01" };
const NO_CACHE: PricingRow = { provider: "openai", model: "gpt-5", input_price_per_1m: 12, output_price_per_1m: 48, effective_date: "2026-01-01" };

describe("deriveCost (the deterministic formula, D10)", () => {
  it("prices input, output, and cached tokens", () => {
    expect(deriveCost({ input_tokens: 1_000_000, output_tokens: 400_000 }, OPUS)).toBe(45);
    expect(deriveCost({ input_tokens: 8_000_000, output_tokens: 1_500_000, cached_input_tokens: 2_000_000 }, { provider: "anthropic", model: "claude-haiku-4-5", input_price_per_1m: 1, output_price_per_1m: 5, cached_input_price_per_1m: 0.1, effective_date: "2026-01-01" })).toBe(15.7);
  });

  it("falls cached tokens back to the input rate when no cached price is set", () => {
    // 1M input * 12 + 0 + 1M cached * 12 (fallback) = 24
    expect(deriveCost({ input_tokens: 1_000_000, output_tokens: 0, cached_input_tokens: 1_000_000 }, NO_CACHE)).toBe(24);
  });
});

describe("reconcileValue (D10)", () => {
  it("clean match is not flagged", () => {
    expect(reconcileValue(45, 45)).toMatchObject({ delta: 0, flagged: false });
  });
  it("a divergence beyond the threshold is flagged", () => {
    const r = reconcileValue(135, 142);
    expect(r.delta).toBe(-7);
    expect(r.flagged).toBe(true);
  });
  it("rounding dust below the floor is not flagged", () => {
    expect(reconcileValue(100, 100.005).flagged).toBe(false);
  });
  it("no reported cost means nothing to reconcile", () => {
    expect(reconcileValue(30, null)).toMatchObject({ reported: null, flagged: false });
  });
});

describe("buildCanonicalEvents on the Anthropic Console sample (D5/D10/D14)", () => {
  const parsed = parseAnthropicConsole(read("sample-anthropic-export.csv"), "synthetic");
  const result = buildCanonicalEvents(parsed.rows);

  it("normalizes every row and re-derives total cost", () => {
    expect(parsed.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(result.events).toHaveLength(8);
    expect(result.reconciliation.totalDerived).toBe(355.2);
  });

  it("reconciles derived against provider-reported and flags only the divergent model", () => {
    const r = result.reconciliation;
    expect(r.hasReported).toBe(true);
    expect(r.totalReported).toBe(362.2);
    expect(r.delta).toBe(-7);
    expect(r.flaggedCount).toBe(1);
    // four opus rows: 45 + 90 + 22.50 + 135 = 292.50 derived; reported 45 + 90 + 22.50 + 142 = 299.50
    const opus = r.byModel.find((m) => m.model === "claude-opus-4-8");
    expect(opus).toMatchObject({ derived: 292.5, reported: 299.5, flagged: true });
    expect(r.byModel.find((m) => m.model === "claude-sonnet-4-6")?.flagged).toBe(false);
  });

  it("resolves owners via the mapping and surfaces the unmapped actor", () => {
    expect(result.unmappedActors).toEqual(["test-key-7f3a2b"]);
    const orphan = result.events.find((e) => e.actor === "test-key-7f3a2b");
    expect(orphan?.team).toBe("Unassigned");
    expect(orphan?.project).toBeNull();
    const eng = result.events.find((e) => e.actor === "eng-prod-key");
    expect(eng?.team).toBe("Engineering");
  });
});

describe("buildCanonicalEvents on the canonical sample", () => {
  const parsed = parseCanonicalCsv(read("sample-canonical.csv"), "synthetic");
  const result = buildCanonicalEvents(parsed.rows);

  it("re-derives cost and keeps each row's own dimensions", () => {
    expect(result.events).toHaveLength(8);
    expect(result.reconciliation.totalDerived).toBe(258.45);
    // canonical sample carries no reported cost, so there is nothing to reconcile
    expect(result.reconciliation.hasReported).toBe(false);
    // null-project rows pass through and will fire missing-owner downstream
    expect(result.events.filter((e) => e.project === null)).toHaveLength(2);
  });
});

describe("unpriced models are surfaced, not silently zeroed", () => {
  it("reports a model with no price row and costs it at 0", () => {
    const rows: RawUsageRow[] = [
      { date: "2026-05-01", actor: "x", provider: "anthropic", model: "claude-ultra-9", input_tokens: 1_000_000, output_tokens: 0, requests: 1, source: "provider-export" },
    ];
    const result = buildCanonicalEvents(rows);
    expect(result.events[0].cost_usd).toBe(0);
    expect(result.unpricedModels).toContain("anthropic/claude-ultra-9");
  });
});
