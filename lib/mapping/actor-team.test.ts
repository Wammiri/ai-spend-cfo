import { describe, it, expect } from "vitest";
import type { RawUsageRow } from "../types";
import {
  DEFAULT_MAPPING,
  distinctActors,
  matchRule,
  resolveDimensions,
} from "./actor-team";

// The mapping is the product's normalization value (D14). These prove the three
// paths that matter: a canonical row keeps its own dimensions, a provider-export
// actor is resolved by rule, and an unmapped actor falls to Unassigned with a
// null project so the missing-owner flag fires.

function raw(partial: Partial<RawUsageRow>): RawUsageRow {
  return {
    date: "2026-05-01",
    actor: "x",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    input_tokens: 0,
    output_tokens: 0,
    requests: 1,
    source: "provider-export",
    ...partial,
  };
}

describe("matchRule", () => {
  it("matches a substring case-insensitively, first rule wins", () => {
    expect(matchRule("eng-prod-key", DEFAULT_MAPPING)?.team).toBe("Engineering");
    expect(matchRule("MARKETING-content", DEFAULT_MAPPING)?.team).toBe("Marketing");
    expect(matchRule("finance-fpa-key", DEFAULT_MAPPING)?.team).toBe("Finance");
  });

  it("returns null when nothing matches", () => {
    expect(matchRule("test-key-7f3a2b", DEFAULT_MAPPING)).toBeNull();
  });
});

describe("resolveDimensions", () => {
  it("honors a canonical row's own dimensions verbatim", () => {
    const d = resolveDimensions(
      raw({ team: "Finance", workflow: "Variance analysis", value_tag: "high", environment: "prod", project: "FP&A", approval_status: "approved" }),
      DEFAULT_MAPPING,
    );
    expect(d).toMatchObject({ team: "Finance", workflow: "Variance analysis", value_tag: "high", project: "FP&A", unmapped: false });
  });

  it("resolves a provider-export actor through the mapping", () => {
    const d = resolveDimensions(raw({ actor: "support-bot-key" }), DEFAULT_MAPPING);
    expect(d).toMatchObject({ team: "Customer Support", project: "Support Ops", value_tag: "high", unmapped: false });
    // approval is never inferred by the mapping: defaults to approved
    expect(d.approval_status).toBe("approved");
  });

  it("falls an unmapped actor to Unassigned with a null project (fires missing-owner)", () => {
    const d = resolveDimensions(raw({ actor: "test-key-7f3a2b" }), DEFAULT_MAPPING);
    expect(d.team).toBe("Unassigned");
    expect(d.project).toBeNull();
    expect(d.unmapped).toBe(true);
  });
});

describe("distinctActors", () => {
  it("returns actors in first-seen order without duplicates", () => {
    const rows = [raw({ actor: "a" }), raw({ actor: "b" }), raw({ actor: "a" })];
    expect(distinctActors(rows)).toEqual(["a", "b"]);
  });
});
