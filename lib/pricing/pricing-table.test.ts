import { describe, it, expect } from "vitest";
import {
  PRICING_TABLE,
  pricedModels,
  selectPrice,
} from "./pricing-table";

// Pricing is the single source of truth for cost (D10/D11). These prove the
// effective-date versioning selection, which keeps historical spend correctly
// priced when a vendor changes a price mid-stream.

describe("selectPrice (effective-date versioning, D11)", () => {
  it("selects the latest row on or before the event date", () => {
    // claude-opus-4-8 has a prior row (2025-06-01, 18/90) and a current row (2026-01-01, 15/75).
    const may = selectPrice("anthropic", "claude-opus-4-8", "2026-05-04");
    expect(may?.input_price_per_1m).toBe(15);
    expect(may?.effective_date).toBe("2026-01-01");

    const lastYear = selectPrice("anthropic", "claude-opus-4-8", "2025-09-01");
    expect(lastYear?.input_price_per_1m).toBe(18);
    expect(lastYear?.effective_date).toBe("2025-06-01");
  });

  it("returns null before any row is effective", () => {
    expect(selectPrice("anthropic", "claude-opus-4-8", "2025-01-01")).toBeNull();
  });

  it("returns null for an unknown model (so it can be flagged, not silently zeroed)", () => {
    expect(selectPrice("anthropic", "claude-ultra-9", "2026-05-04")).toBeNull();
  });

  it("matches provider and model case-insensitively", () => {
    expect(selectPrice("Anthropic", "Claude-Sonnet-4-6", "2026-05-04")?.input_price_per_1m).toBe(3);
  });
});

describe("pricedModels", () => {
  it("lists each model once, at its latest effective row", () => {
    const models = pricedModels();
    const opus = models.filter((m) => m.model === "claude-opus-4-8");
    expect(opus).toHaveLength(1);
    expect(opus[0].input_price_per_1m).toBe(15);
    // every model in the table appears exactly once
    const distinct = new Set(PRICING_TABLE.map((r) => `${r.provider}|${r.model}`));
    expect(models).toHaveLength(distinct.size);
  });
});
