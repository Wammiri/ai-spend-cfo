// Deterministic compute layer (barrel).
//
// Architectural law (CLAUDE.md, DISCOVERY.md section 4): deterministic code
// computes every number; the AI never calculates. Every total, variance,
// forecast, and saving the product reports is produced by a pure function in
// this directory, from the canonical data. The AI receives already-computed
// numbers and turns them into language.
//
// Batch B0 stands up this skeleton with the test runner passing. The pure
// functions land in later batches and are re-exported from here:
//   - cost.ts        cost derivation + reconciliation (D10), Batch B2
//   - budget.ts      pace, expected, variance, status with guards (D13), Batch B3
//   - forecast.ts    run-rate / recent-trend / scenarios (D13), Batch B3
//   - risk.ts        quantified flags + tier repricing (D12), Batch B4
//   - eligibility.ts C1: partition eligible vs needs-review, Batch B4
//   - aggregate.ts   load-time aggregations for KPIs and charts, Batch B1/B3
//
// Re-exports are added as each module arrives. This file is intentionally a
// pure module with no side effects.

export {};
