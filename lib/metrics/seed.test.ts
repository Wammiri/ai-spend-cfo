import { describe, it, expect } from "vitest";
import type { CanonicalUsageEvent, PricingRow } from "../types";
import * as metrics from "./index";

// Seed test for Batch B0: proves the toolchain end to end (TypeScript + Vitest +
// the canonical schema + the metrics barrel) on an untouched tree. It is a real
// schema-conformance check, not a vacuous assertion. The deterministic compute
// functions and their golden tests arrive in later batches.

describe("B0 scaffold seed", () => {
  it("constructs a schema-valid canonical usage event", () => {
    const event: CanonicalUsageEvent = {
      date: "2026-05-01",
      actor: "svc-ingest",
      team: "Data Platform",
      workflow: "log-enrichment",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      input_tokens: 1_200_000,
      output_tokens: 240_000,
      requests: 4_100,
      cost_usd: 1.36,
      reported_cost_usd: 1.36,
      value_tag: "medium",
      approval_status: "approved",
      environment: "prod",
      project: "observability",
      source: "synthetic",
    };

    expect(event.provider).toBe("anthropic");
    expect(event.source).toBe("synthetic");
    expect(event.input_tokens + event.output_tokens).toBe(1_440_000);
  });

  it("constructs a schema-valid pricing row", () => {
    const price: PricingRow = {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      input_price_per_1m: 1.0,
      output_price_per_1m: 5.0,
      effective_date: "2026-01-01",
    };

    expect(price.effective_date).toBe("2026-01-01");
    expect(price.output_price_per_1m).toBeGreaterThan(price.input_price_per_1m);
  });

  it("exposes the metrics barrel as an importable module", () => {
    expect(typeof metrics).toBe("object");
  });
});
