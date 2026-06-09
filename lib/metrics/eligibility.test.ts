import { describe, it, expect } from "vitest";
import {
  partitionDrivers,
  DEFAULT_ELIGIBILITY,
  type DriverDatum,
} from "./eligibility";

// Control C1 golden test (DISCOVERY section 8, CLAUDE.md): a thin-data driver
// must never reach the recommendations set. We prove BOTH the allowed case (a
// well-supported driver is eligible) and the forbidden case (a driver that fails
// the data floor on any axis is excluded and only appears under needs-review).

const wellSupported: DriverDatum = {
  team: "Data Science",
  workflow: "Model evaluation harness",
  value: 1457.26,
  events: 42,
  hasOwner: true,
};

const thinEvents: DriverDatum = {
  team: "Sales",
  workflow: "Call-note summarization",
  value: 220,
  events: 2, // below MIN_EVENTS
  hasOwner: true,
};

const ownerless: DriverDatum = {
  team: "Unassigned",
  workflow: "Unassigned",
  value: 300,
  events: 12,
  hasOwner: false, // no attributable owner
};

const tinyDollars: DriverDatum = {
  team: "Product",
  workflow: "Internal docs",
  value: 20, // below DOLLAR_FLOOR
  events: 9,
  hasOwner: true,
};

describe("partitionDrivers (C1: needs-review decided in code)", () => {
  const { eligible, needsReview } = partitionDrivers([
    wellSupported,
    thinEvents,
    ownerless,
    tinyDollars,
  ]);
  const eligibleLabels = eligible.map((d) => d.label);
  const needsReviewLabels = needsReview.map((d) => d.label);

  it("admits a well-supported driver (the allowed case)", () => {
    expect(eligibleLabels).toContain("Data Science / Model evaluation harness");
  });

  it("never lets a thin-event driver reach recommendations (golden)", () => {
    expect(eligibleLabels).not.toContain("Sales / Call-note summarization");
    expect(needsReviewLabels).toContain("Sales / Call-note summarization");
  });

  it("excludes an ownerless driver", () => {
    expect(eligibleLabels).not.toContain("Unassigned / Unassigned");
    expect(needsReviewLabels).toContain("Unassigned / Unassigned");
  });

  it("excludes a sub-floor-dollar driver", () => {
    expect(eligibleLabels).not.toContain("Product / Internal docs");
    expect(needsReviewLabels).toContain("Product / Internal docs");
  });

  it("records a specific reason for each excluded driver", () => {
    expect(needsReview.find((d) => d.label.startsWith("Sales"))?.reason).toMatch(/event/i);
    expect(needsReview.find((d) => d.label.startsWith("Unassigned"))?.reason).toMatch(/owner/i);
    expect(needsReview.find((d) => d.label.startsWith("Product"))?.reason).toMatch(/floor/i);
  });

  it("the gate is the one-line switch (lowering it admits the thin ones)", () => {
    const relaxed = partitionDrivers([thinEvents, tinyDollars], {
      minEvents: 1,
      dollarFloor: 1,
    });
    expect(relaxed.eligible.map((d) => d.label)).toEqual([
      "Sales / Call-note summarization",
      "Product / Internal docs",
    ]);
    expect(relaxed.needsReview).toHaveLength(0);
  });

  it("uses the documented default floors", () => {
    expect(DEFAULT_ELIGIBILITY).toEqual({ minEvents: 3, dollarFloor: 50 });
  });
});
