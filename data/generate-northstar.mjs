// Reproducible generator for the Northstar AI Labs synthetic sample dataset.
//
// Run: `node data/generate-northstar.mjs` (writes data/northstar.json and prints
// the headline aggregates). Northstar is SYNTHETIC (D9): every event carries
// source = "synthetic" and is labeled "sample" everywhere in the UI. The data is
// physically plausible: token counts are randomized with a fixed seed and
// cost_usd is DERIVED (tokens x embedded per-1M prices), so the numbers behave
// like real usage rather than being typed in. These embedded prices are for the
// synthetic sample only; the authoritative, human-confirmed pricing table is a
// B2 concern (D11). No network, no dependencies: plain Node.
//
// Period: the full, CLOSED month of May 2026 (31 days). A closed month means the
// dashboard and the cached memo report ACTUALS, with no pacing or forecast guard
// to apply (forecasting is B3, D13). House rule: no em dashes in any output text.

import { writeFileSync } from "node:fs";

// --- deterministic RNG (mulberry32), so regenerating is byte-stable -----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260501);
const rand = (min, max) => min + (max - min) * rng();
const randInt = (min, max) => Math.round(rand(min, max));
function pickWeighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

// --- model catalogue + embedded synthetic pricing (USD per 1M tokens) ---------
const MODELS = {
  "claude-opus-4-8": { provider: "anthropic", tier: "frontier", in: 15, out: 75 },
  "claude-sonnet-4-6": { provider: "anthropic", tier: "mid", in: 3, out: 15 },
  "claude-haiku-4-5": { provider: "anthropic", tier: "cheap", in: 1, out: 5 },
  "gpt-5": { provider: "openai", tier: "frontier", in: 12, out: 48 },
  "gpt-5-mini": { provider: "openai", tier: "mid", in: 0.6, out: 2.4 },
  "gemini-2.5-pro": { provider: "google", tier: "frontier", in: 7, out: 21 },
  "gemini-2.5-flash": { provider: "google", tier: "cheap", in: 0.3, out: 1.2 },
};

const round2 = (n) => Math.round(n * 100) / 100;
function deriveCost(model, inputTokens, outputTokens) {
  const p = MODELS[model];
  return round2(
    (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out,
  );
}

// --- workflow catalogue (the multi-department narrative) ----------------------
// Each workflow drives one aggregated row per active day. modelMix is a weighted
// pick so a workflow spreads across models over the month. The story is encoded
// here: efficient high-value teams (Finance, Support) vs avoidable spend
// (frontier models on low-value/low-complexity work in Marketing and Product),
// plus unapproved experiment spend and ownerless rows.
const WORKFLOWS = [
  // Engineering: largest spend, mostly approved and owned, high/medium value.
  { team: "Engineering", workflow: "Code assistant", value: "high", project: "Platform", expProb: 0.1, unapprovedProb: 0.02, modelMix: [["claude-sonnet-4-6", 6], ["claude-opus-4-8", 2], ["gpt-5-mini", 2]], reqs: [220, 620], inTok: [3000, 11000], outTok: [700, 2400], weekendFactor: 0.45 },
  { team: "Engineering", workflow: "Agentic test generation", value: "medium", project: "Platform", expProb: 0.35, unapprovedProb: 0.06, modelMix: [["claude-sonnet-4-6", 5], ["claude-opus-4-8", 3], ["gemini-2.5-pro", 2]], reqs: [60, 220], inTok: [6000, 18000], outTok: [1500, 4500], weekendFactor: 0.4 },
  { team: "Engineering", workflow: "Incident triage copilot", value: "high", project: "Reliability", expProb: 0.05, unapprovedProb: 0.02, modelMix: [["claude-sonnet-4-6", 7], ["claude-haiku-4-5", 3]], reqs: [40, 160], inTok: [2500, 7000], outTok: [600, 1800], weekendFactor: 0.9 },

  // Data Science: heavy experimentation, lots of experiment env + unapproved.
  { team: "Data Science", workflow: "Model evaluation harness", value: "medium", project: "Research", expProb: 0.8, unapprovedProb: 0.4, modelMix: [["claude-opus-4-8", 4], ["gpt-5", 3], ["gemini-2.5-pro", 3]], reqs: [40, 180], inTok: [8000, 26000], outTok: [2500, 9000], weekendFactor: 0.5 },
  { team: "Data Science", workflow: "Synthetic data generation", value: "low", project: null, expProb: 0.95, unapprovedProb: 0.55, modelMix: [["claude-opus-4-8", 5], ["gpt-5", 3], ["claude-sonnet-4-6", 2]], reqs: [20, 90], inTok: [4000, 12000], outTok: [4000, 14000], weekendFactor: 0.6 },
  { team: "Data Science", workflow: "Feature exploration notebooks", value: "medium", project: "Research", expProb: 0.7, unapprovedProb: 0.25, modelMix: [["claude-sonnet-4-6", 6], ["gemini-2.5-pro", 4]], reqs: [30, 120], inTok: [5000, 15000], outTok: [1500, 5000], weekendFactor: 0.4 },

  // Marketing: the avoidable-spend story (frontier models on content gen).
  { team: "Marketing", workflow: "Campaign content generation", value: "low", project: "Demand Gen", expProb: 0.45, unapprovedProb: 0.2, modelMix: [["claude-opus-4-8", 6], ["gpt-5", 3], ["claude-sonnet-4-6", 1]], reqs: [40, 130], inTok: [3000, 7000], outTok: [2500, 6000], weekendFactor: 0.5 },
  { team: "Marketing", workflow: "SEO and blog drafting", value: "low", project: "Content", expProb: 0.3, unapprovedProb: 0.12, modelMix: [["gpt-5", 5], ["claude-opus-4-8", 3], ["gemini-2.5-pro", 2]], reqs: [20, 70], inTok: [2000, 5000], outTok: [2000, 5500], weekendFactor: 0.35 },
  { team: "Marketing", workflow: "Ad copy variants", value: "medium", project: "Demand Gen", expProb: 0.25, unapprovedProb: 0.08, modelMix: [["claude-sonnet-4-6", 6], ["gpt-5-mini", 4]], reqs: [40, 120], inTok: [800, 2500], outTok: [600, 2000], weekendFactor: 0.4 },

  // Product: advanced models on low-complexity internal documentation.
  { team: "Product", workflow: "Internal documentation", value: "low", project: "Docs", expProb: 0.2, unapprovedProb: 0.05, modelMix: [["claude-opus-4-8", 5], ["gpt-5", 2], ["claude-sonnet-4-6", 3]], reqs: [25, 90], inTok: [3000, 8000], outTok: [1500, 4000], weekendFactor: 0.35 },
  { team: "Product", workflow: "PRD and spec drafting", value: "medium", project: "Roadmap", expProb: 0.25, unapprovedProb: 0.08, modelMix: [["claude-sonnet-4-6", 6], ["claude-opus-4-8", 4]], reqs: [15, 60], inTok: [4000, 10000], outTok: [2000, 5000], weekendFactor: 0.3 },
  { team: "Product", workflow: "User research synthesis", value: "high", project: "Discovery", expProb: 0.3, unapprovedProb: 0.06, modelMix: [["claude-sonnet-4-6", 7], ["gemini-2.5-pro", 3]], reqs: [10, 45], inTok: [6000, 16000], outTok: [2000, 6000], weekendFactor: 0.3 },

  // Customer Support: very high volume on cheap models (efficient, low $/req).
  { team: "Customer Support", workflow: "Ticket summarization", value: "high", project: "Support Ops", expProb: 0.02, unapprovedProb: 0.01, modelMix: [["claude-haiku-4-5", 8], ["gemini-2.5-flash", 2]], reqs: [900, 2600], inTok: [1500, 4000], outTok: [300, 900], weekendFactor: 0.8 },
  { team: "Customer Support", workflow: "Suggested reply drafting", value: "medium", project: "Support Ops", expProb: 0.05, unapprovedProb: 0.02, modelMix: [["claude-haiku-4-5", 6], ["gpt-5-mini", 2], ["gemini-2.5-flash", 2]], reqs: [400, 1300], inTok: [1200, 3000], outTok: [400, 1100], weekendFactor: 0.85 },

  // Finance: small, disciplined, high value (the "Finance is efficient" note).
  { team: "Finance", workflow: "Board memo drafting", value: "high", project: "FP&A", expProb: 0.05, unapprovedProb: 0.01, modelMix: [["claude-opus-4-8", 6], ["claude-sonnet-4-6", 4]], reqs: [6, 26], inTok: [6000, 14000], outTok: [2000, 5000], weekendFactor: 0.25 },
  { team: "Finance", workflow: "Variance analysis", value: "high", project: "FP&A", expProb: 0.05, unapprovedProb: 0.01, modelMix: [["claude-sonnet-4-6", 8], ["claude-opus-4-8", 2]], reqs: [8, 34], inTok: [4000, 11000], outTok: [1500, 4000], weekendFactor: 0.2 },

  // Sales: outreach drafting, medium value, some unapproved.
  { team: "Sales", workflow: "Outreach drafting", value: "medium", project: "Pipeline", expProb: 0.2, unapprovedProb: 0.18, modelMix: [["claude-sonnet-4-6", 5], ["gpt-5-mini", 4], ["claude-haiku-4-5", 1]], reqs: [60, 220], inTok: [1000, 3000], outTok: [500, 1600], weekendFactor: 0.3 },
  { team: "Sales", workflow: "Call note summarization", value: "medium", project: null, expProb: 0.3, unapprovedProb: 0.22, modelMix: [["claude-haiku-4-5", 6], ["gpt-5-mini", 4]], reqs: [40, 150], inTok: [2000, 5000], outTok: [400, 1200], weekendFactor: 0.35 },
];

// --- generate the month -------------------------------------------------------
const YEAR = 2026;
const MONTH = 5; // May
const DAYS_IN_MONTH = 31;

const events = [];
for (let day = 1; day <= DAYS_IN_MONTH; day++) {
  const date = `${YEAR}-${String(MONTH).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dow = new Date(Date.UTC(YEAR, MONTH - 1, day)).getUTCDay();
  const isWeekend = dow === 0 || dow === 6;

  for (const wf of WORKFLOWS) {
    const dayFactor = isWeekend ? wf.weekendFactor : 1;
    // a little day-to-day noise so the trend line is not flat
    const noise = rand(0.78, 1.22);
    const requests = Math.max(1, Math.round(randInt(wf.reqs[0], wf.reqs[1]) * dayFactor * noise));
    if (requests < 1) continue;

    const model = pickWeighted(wf.modelMix);
    const inPerReq = randInt(wf.inTok[0], wf.inTok[1]);
    const outPerReq = randInt(wf.outTok[0], wf.outTok[1]);
    const input_tokens = requests * inPerReq;
    const output_tokens = requests * outPerReq;
    // cached input only on cheap, high-volume support workflows (realistic)
    const cached =
      MODELS[model].tier === "cheap" && rng() < 0.5
        ? Math.round(input_tokens * rand(0.1, 0.35))
        : undefined;

    const cost_usd = deriveCost(model, input_tokens, output_tokens);
    const environment = rng() < wf.expProb ? "experiment" : "prod";
    const approval_status = rng() < wf.unapprovedProb ? "unapproved" : "approved";
    // ownerless rows: configured null projects, plus a small leak in experiments
    let project = wf.project;
    if (project !== null && environment === "experiment" && rng() < 0.18) project = null;

    const event = {
      date,
      actor: `${wf.team.toLowerCase().replace(/[^a-z]+/g, "-")}-${wf.workflow.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      team: wf.team,
      workflow: wf.workflow,
      provider: MODELS[model].provider,
      model,
      input_tokens,
      output_tokens,
      ...(cached !== undefined ? { cached_input_tokens: cached } : {}),
      requests,
      cost_usd,
      value_tag: wf.value,
      approval_status,
      environment,
      project,
      source: "synthetic",
    };
    events.push(event);
  }
}

// --- illustrative monthly department budgets (B3, D13) ------------------------
// These are SAMPLE budgets for the synthetic demo, not confirmed business
// figures (budgets are a product/business input, a human gate). They are chosen
// so the variance view tells an honest governance story: Data Science and
// Marketing run over budget (the avoidable-spend teams), Engineering lands right
// at budget, and the disciplined teams (Finance, Support, Sales) come in under.
// Defined after event generation so the seeded RNG (and every event) is
// untouched; only this block is appended.
const BUDGETS = [
  { dimension: "team", key: "Data Science", amount_usd: 2000 },
  { dimension: "team", key: "Engineering", amount_usd: 1600 },
  { dimension: "team", key: "Marketing", amount_usd: 700 },
  { dimension: "team", key: "Product", amount_usd: 600 },
  { dimension: "team", key: "Customer Support", amount_usd: 500 },
  { dimension: "team", key: "Finance", amount_usd: 250 },
  { dimension: "team", key: "Sales", amount_usd: 150 },
];

// --- assemble dataset ---------------------------------------------------------
const modelList = Object.entries(MODELS).map(([model, m]) => ({
  provider: m.provider,
  model,
  tier: m.tier,
}));

const dataset = {
  meta: {
    org: "Northstar AI Labs",
    period: `${YEAR}-${String(MONTH).padStart(2, "0")}`,
    period_label: "May 2026",
    period_status: "closed",
    currency: "USD",
    source: "synthetic",
    label: "Sample data",
    generated_by: "data/generate-northstar.mjs",
    note: "Synthetic sample. Costs are derived from token counts at embedded illustrative prices for the demo; the authoritative pricing table is built in B2 (D11).",
    budgets_note: "Illustrative monthly department budgets for the sample (B3), not confirmed business figures.",
    row_count: events.length,
  },
  budgets: BUDGETS,
  models: modelList,
  events,
};

writeFileSync(new URL("./northstar.json", import.meta.url), JSON.stringify(dataset, null, 2) + "\n");

// --- print headline aggregates (used to author the cached memo honestly) ------
const sum = (arr, f) => arr.reduce((s, e) => s + f(e), 0);
const byKey = (f) => {
  const m = new Map();
  for (const e of events) m.set(f(e), (m.get(f(e)) ?? 0) + e.cost_usd);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const tierOf = (model) => MODELS[model].tier;
const total = sum(events, (e) => e.cost_usd);
const fmt = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;

console.log(`Rows: ${events.length}`);
console.log(`Total spend: ${fmt(total)}`);
console.log(`Total requests: ${sum(events, (e) => e.requests).toLocaleString("en-US")}`);
console.log(`Cost / request: $${(total / sum(events, (e) => e.requests)).toFixed(4)}`);
console.log("\nBy team:");
for (const [k, v] of byKey((e) => e.team)) console.log(`  ${k}: ${fmt(v)} (${pct(v)})`);
console.log("\nBy provider:");
for (const [k, v] of byKey((e) => e.provider)) console.log(`  ${k}: ${fmt(v)} (${pct(v)})`);
console.log("\nBy tier:");
for (const [k, v] of byKey((e) => tierOf(e.model))) console.log(`  ${k}: ${fmt(v)} (${pct(v)})`);
console.log("\nBy value tag:");
for (const [k, v] of byKey((e) => e.value_tag)) console.log(`  ${k}: ${fmt(v)} (${pct(v)})`);
console.log("\nTop workflows:");
for (const [k, v] of byKey((e) => `${e.team} / ${e.workflow}`).slice(0, 8)) console.log(`  ${k}: ${fmt(v)} (${pct(v)})`);
console.log("\nWaste indicators:");
console.log(`  Low-value spend: ${fmt(sum(events.filter((e) => e.value_tag === "low"), (e) => e.cost_usd))}`);
console.log(`  Unapproved spend: ${fmt(sum(events.filter((e) => e.approval_status === "unapproved"), (e) => e.cost_usd))}`);
console.log(`  Missing-owner spend: ${fmt(sum(events.filter((e) => e.project === null), (e) => e.cost_usd))}`);
console.log(`  Frontier-tier spend: ${fmt(sum(events.filter((e) => tierOf(e.model) === "frontier"), (e) => e.cost_usd))} (${pct(sum(events.filter((e) => tierOf(e.model) === "frontier"), (e) => e.cost_usd))})`);
console.log(`  Frontier-on-low-value spend: ${fmt(sum(events.filter((e) => tierOf(e.model) === "frontier" && e.value_tag === "low"), (e) => e.cost_usd))}`);

console.log("\nBudget vs actual (closed month, illustrative sample budgets):");
const actualByTeam = new Map(byKey((e) => e.team));
let budgetTotal = 0;
for (const b of BUDGETS) {
  const actual = actualByTeam.get(b.key) ?? 0;
  budgetTotal += b.amount_usd;
  const v = actual - b.amount_usd;
  const verdict = v > 0 ? `${fmt(v)} over` : `${fmt(-v)} under`;
  console.log(`  ${b.key}: budget ${fmt(b.amount_usd)}, actual ${fmt(actual)} (${verdict}, ${((actual / b.amount_usd) * 100).toFixed(0)}%)`);
}
const totalVar = total - budgetTotal;
console.log(`  TOTAL: budget ${fmt(budgetTotal)}, actual ${fmt(total)} (${totalVar > 0 ? fmt(totalVar) + " over" : fmt(-totalVar) + " under"})`);
