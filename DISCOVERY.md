# DISCOVERY — AI Spend CFO

**Version:** 1.0
**Date:** 2026-06-09
**Mode:** New build, from a PRD (grill).
**Source PRD:** `AI_Spend_CFO_Spec_v1.md`
**Status:** Discovery complete. This document is the source the rest of the building pack is generated from. `DECISIONS.md`, `BATCH_PLAN.md`, `CLAUDE.md`, `SESSION_LOG.md`, and `CHANGELOG.md` are produced from here in a fresh session.

House rule observed throughout: no em dashes.

---

## 1. What the product is

AI Spend CFO is the FP&A layer for AI spend. It turns raw AI usage logs into budget variance, spend forecasts, waste detection, and a CFO-ready control memo.

**The insight it is downstream of:** AI spend is becoming operational spend, but almost nobody is managing it with finance-grade controls yet. Usage-based cost is spreading across teams faster than finance can track ownership, budget, value, and waste. Finance sees the bill after the spend has happened.

**Positioning:** AI cost governance for finance, not AI analytics for engineering. The mental model is governance (budgets, variance, ownership, controls), not monitoring (observability dashboards). The line: "FinOps tools tell engineers what they spent. Nobody gives finance a way to govern it. That is this."

**The hero:** the CFO memo. Dashboards and charts are table stakes. The board-ready narrative memo is the differentiator and the thing every screenshot, demo, and launch post leads with.

---

## 2. Weight class (right-sizing decision)

This is a **portfolio / credibility artifact**, optimized as a single-tenant public demo. It is deliberately **light** on the machinery a real multi-user SaaS would need (no auth, no multi-tenancy, no database in v1, no billing) and deliberately **heavy** on the two things that are the moat:

1. Data credibility (real own-spend data plus one real provider parser plus honest labeling).
2. Memo quality and honesty (the board-ready artifact, with code-enforced truth).

Signals that would normally push a project to a heavier weight class (multiple roles, multi-tenant data, regulated data, real money, autonomous tool use) are all **absent here**, which is why the light class is correct. The control matrix in §8 is therefore small and targets only the controls that actually carry the product's credibility claim, not a full enterprise matrix.

The success test for every tradeoff: **a finance leader or a hiring manager is convinced in under 60 seconds, and the memo is the proof.** Optimize for that, not for "a stranger can sign up and run their company on it."

---

## 3. The audience and the definition of success

**Single audience being optimized for:** people who hire or evaluate FP&A and finance-systems talent (the LinkedIn finance crowd), and finance leaders who recognize the problem. Distribution is LinkedIn-primary, cross-posted to X.

**Success is reached when:**
- A stranger understands the product in 10 seconds on the landing page.
- The memo reads as something a CFO would actually forward, on real-looking numbers.
- At least one view runs on genuinely real numbers (the builder's own AI spend).
- At least one real provider export parses end to end.
- You would be proud to put the link in a job application.

This is the §9 credibility checklist of the spec, treated as the launch gate. It is reproduced in §9 of this document.

---

## 4. Architectural laws (do not violate)

These are inherited from the spec and are non-negotiable. They are what make the product read as finance judgment rather than a chatbot over a spreadsheet.

1. **Deterministic code computes every number. The AI never calculates.** All totals, variances, forecasts, and savings are produced by code from the data. The AI receives already-computed numbers and turns them into language, narrative, and recommendations.
2. **The AI flags gaps rather than inventing causes.** Where a cause is not supported by the data, it is marked "needs review" and excluded from recommendations. This honesty stance is a deliberate differentiator and is stated openly on the methodology page.

Both laws are made enforceable (not left as prose) by the control matrix in §8.

---

## 5. Resolved decisions (the grill output)

Every branch resolved during the grill on 2026-06-09. Confidence is noted where a decision is an inference rather than an explicit user statement. These seed `DECISIONS.md`.

### 5.1 Foundation

| ID | Decision | Why | Confidence |
|---|---|---|---|
| D1 | Portfolio / credibility artifact, single-tenant, no auth, moat-first. "Real multi-user product" is a deferred non-goal kept cheap to unlock, not built now. | The spec frames it as portfolio-grade and targets people who hire FP&A talent. The two goals (portfolio vs real SaaS) conflict on tradeoffs, and portfolio wins. | User-confirmed |
| D2 | No database in v1. Sample data ships as bundled static JSON/CSV. Uploads are parsed in-browser, computed in pure functions, rendered, and exported. Nothing persists. Supabase is added later only if a feature forces persistence, and is flagged at that point. | A DB adds migrations, secrets, RLS, and cold-starts that can break the hero during a 60-second visit, for no gain in a single-tenant demo. The canonical schema is demonstrated as code/types plus the methodology page, not by hosting Postgres. | User-confirmed |
| D3 | Hybrid memo generation. The sample-data memo (Northstar plus the builder's own spend) is precomputed once and cached, so the hero loads instantly, costs nothing per visit, and cannot fail or be abused. User uploads trigger a live Claude call via a rate-limited serverless route with the key held server-side. | Best of both: a perfect, reliable hero screenshot, and a provably-live pipeline on real uploaded data. | User-confirmed |
| D4 | Memo rendering and export: a polished on-screen HTML/React memo is the screenshot hero; the downloadable PDF is produced with `@react-pdf/renderer`. jsPDF is dropped. | The on-screen memo is the real LinkedIn distribution asset; the PDF is a credibility checkbox that must look board-made. jsPDF fights layout and reads as developer-made. The new dependency is justified because the memo artifact is the differentiator. | User-confirmed |

### 5.2 The spec's §14 open decisions

| ID | Decision | Why | Confidence |
|---|---|---|---|
| D5 | First real provider export parsed: **Anthropic Console** usage/cost export. | The builder uses Claude, so real Tier-1 data and the Tier-2 parser exercise the same provider, closing the credibility loop fastest. | User-confirmed (provider inferred from Claude usage; reconfirm the exact export format available in the console) |
| D6 | Value tagging: **both, editable.** A deterministic rule map (workflow to tier) is the default and the source of truth. Haiku suggests tiers for unmapped workflows (classification only, the legit AI use). User overrides persist in the mapping. | Keeps code in charge of the number while using AI only for the judgment it is allowed to make per §4. | User-confirmed |
| D7 | Branding: shipped under the **Aperio Finance** umbrella, product name "AI Spend CFO". | Signals a finance-systems body of work rather than a one-off, which is the hiring signal wanted. | User-confirmed |
| D8 | Demo scope: **public no-login demo plus ephemeral upload at launch.** Sample data loads for everyone. CSV / provider-export upload is parsed in-browser and never stored. | Proves "it actually works" on real data without auth or persistence, consistent with D1 and D2. | User-confirmed |
| D9 | Real-data depth: **the builder's own spend only for v1.** A friendly company's anonymized data is a post-launch stretch, not a launch blocker. | Own spend is the launch story and the anti-mockup anchor. Multi-team richness is carried by clearly-labeled synthetic Northstar data. | User-confirmed |

### 5.3 Sharp edges surfaced and resolved

| ID | Decision | Why | Confidence |
|---|---|---|---|
| D10 | Cost derivation plus reconciliation. Always re-derive `cost_usd` from the pricing table as the source of truth. When an export also reports a dollar cost, store it and show a reconciliation delta; flag divergence beyond a threshold. | Re-derivation gives one canonical method across providers; reconciliation against provider-reported cost is itself a finance-credibility flex. | User-confirmed (recommendation accepted) |
| D11 | Pricing table versioning. Seed a small curated table (the models actually used plus common ones), each row carrying `effective_date`. For any event, select the latest price row with `effective_date <= event date`. Show "prices as of …" on the methodology page. Maintained manually by the builder. | Prices change; versioning by effective date keeps historical costs correct and the method honest. | User-confirmed |
| D12 | Model tiers and repricing. A static, editable map keyed by provider+model into frontier / mid / cheap, with a recommended cheaper target per tier. Misuse savings = current cost minus the same tokens repriced at the cheaper tier. | Deterministic savings figure with no AI in the number, per §4. | User-confirmed |
| D13 | Forecast guards. Calendar-day pacing by default; business-day pacing exposed as a noted one-line-switch assumption. If `days_elapsed < 3`, the forecast is labeled "early / low confidence" rather than reported as an overrun. If a dimension has no budget, show "no budget set", never a false overrun. | Early-month run-rate is noisy; unguarded it produces alarmist or false variance, which would undercut credibility. | User-confirmed |
| D14 | Normalization mapping (actor to team). A visible, user-editable mapping table: actor / API-key label to team, workflow, environment, project, and default value_tag. Unmapped actors fall to "Unassigned" and fire the missing-owner flag. | The mapping is the product's normalization value, so it is a visible feature, not hidden config. | User-confirmed |
| D15 | Scale assumption. Design for up to roughly 50k canonical rows computed in-browser, aggregated on load. No pagination, no server-side compute. | The real month is tiny; synthetic Northstar is a few thousand rows. In-browser compute is comfortable at this scale. | User-confirmed (revisit only if a dataset exceeds the assumption) |
| D16 | Tech stack specifics: Next.js (App Router) on Vercel; Tremor for the dashboard (built on Recharts), Recharts directly only where Tremor lacks a chart; Papa Parse for CSV; `@react-pdf/renderer` for PDF. Memo model: Opus-class (quality is the differentiator, volume is low). Value-tag classification model: Haiku (cheap, simple). | Next.js gives the single serverless route the live upload memo needs with no extra plumbing. Tremor reaches a polished finance look fastest. Model choices match the value of each call. | User-confirmed (framework and model choices inferred from constraints; high confidence, reversible) |

---

## 6. Core principle and the AI layer boundary

**Allowed for the AI (judgment / language):** generate the memo; explain variance drivers from given numbers; summarize risk flags; recommend controls; classify workflows into value tiers; translate dashboard findings into executive language.

**Forbidden for the AI (computation / truth):** computing any total, variance, forecast, or savings; inventing a cause not supported by the data; asserting facts without the underlying numbers.

The memo prompt receives only computed inputs: summary metrics, the budget table, ranked cost drivers, risk flags with dollar impact and recommendation, and forecast scenarios. The prompt instructs the model to use only the data provided, to mark unsupported causes "needs review" and exclude them, and to never compute or restate a number that was not given.

---

## 7. Data model and normalization (the engineering insight)

Every source maps into one canonical usage schema. The product's job is normalization, and the hard real-world fact it solves is that every provider exports a different shape and exports often give tokens, not dollars, so cost must be derived.

**Canonical usage event** (one row = one aggregated usage record): `date`, `actor`, `team`, `workflow`, `provider`, `model`, `input_tokens`, `output_tokens`, `cached_input_tokens` (optional), `requests`, `cost_usd` (derived if absent, see D10), `value_tag` (assigned, high/med/low), `approval_status` (approved/unapproved), `environment` (prod/experiment), `project` (nullable, drives missing-owner flag), `source` (real / provider-export / synthetic, for honest labeling).

**Pricing table:** `provider`, `model`, `input_price_per_1m`, `output_price_per_1m`, `cached_input_price_per_1m` (optional), `effective_date`.

**Cost derivation (deterministic):**
```
cost_usd = input_tokens/1e6        * input_price_per_1m
         + output_tokens/1e6       * output_price_per_1m
         + cached_input_tokens/1e6 * cached_input_price_per_1m
```

**On data layer (D2):** the schema above is represented as code types and documented on the methodology page. It is not hosted in a live database in v1. If persistence is added later, the schema maps directly onto the spec's §8 Postgres tables (`ai_usage_events`, `pricing`, `budgets`, `risk_flags`, `generated_memos`).

**Budget and variance math (in code):**
```
pace               = days_elapsed / days_in_month         (calendar by default; D13)
expected_to_date   = budget * pace
variance_to_date   = actual_to_date - expected_to_date
projected_spend    = run-rate forecast (see forecasting)
projected_variance = projected_spend - budget
budget_used_pct    = actual_to_date / budget
status             = healthy | at risk | overrun (thresholds, e.g. +/-10% / >100%)
```

**Forecasting (all deterministic, show the formula):**
1. Run-rate: `avg_daily_spend_to_date * days_in_month`.
2. Recent-trend: `avg_daily_spend_last_7d * days_remaining + actual_to_date`.
3. Scenario: base (run-rate) / upside (+25% usage) / control (low-value workflows -30%).

**Waste and risk flags (each quantified in dollars):** expensive-model misuse (`current_cost - repriced_at_cheaper_tier`), low-value spend (sum where `value_tag = low`), unapproved spend (sum where `approval_status = unapproved`), early budget overrun (projected variance > 0 with high pace), usage spike (day's spend > 3x trailing-7-day average), missing owner (sum where `project` is null). Duplicate / near-identical prompt detection needs prompt-level data and is out of MVP.

---

## 8. Control matrix (made enforceable, not prose)

The product's entire pitch is finance-grade honesty, so the two controls that carry that claim are written as enforceable rows with a test, per methodology §5. The weight class is light, so the matrix is intentionally small.

| Control | Risk it prevents | Where enforced | Failure behavior | Test that proves it |
|---|---|---|---|---|
| C1: "Needs review" is decided in code, not by AI discretion. Code gates which drivers and flags have sufficient supporting data (minimum event count or dollar floor, non-null dimension) before they are eligible for recommendations. Everything else is passed to the model explicitly tagged "needs review, exclude". | The AI inventing or recommending action on a cause that the data does not support, which would destroy the credibility claim. | Pure function in the metrics layer that partitions drivers/flags into "eligible" and "needs review" before the prompt is assembled. | A thin-data driver is never placed in the recommendations section; it appears only under "needs review". | Golden test: feed a dataset with one well-supported driver and one thin-data driver, assert the thin one never reaches recommendations. |
| C2: Memo number-integrity pass. The serverless route computes all numbers, injects only those into the prompt, then post-validates the model's output so every dollar figure it emits matches a number that was supplied. Unsupported figures are flagged or stripped. | The AI fabricating or misstating a number, violating the core architectural law in §4. | Post-generation validation step in the serverless memo route. | Any dollar figure in the output not traceable to a supplied input is flagged (and stripped or the memo is regenerated). | Test: feed known metrics, assert no unsupported figure survives in the returned memo. |

Both controls join the onboarding read order via this document once the pack exists.

---

## 9. Credibility checklist (the anti-mockup launch gate)

Every box must be true before launch:
- [ ] At least one view runs on real numbers (the builder's own spend).
- [ ] At least one real provider export (Anthropic Console, D5) parses end to end.
- [ ] Synthetic data (Northstar) is labeled "sample" everywhere it appears.
- [ ] A "how cost is calculated" page shows the pricing table and the derivation formula.
- [ ] The memo produces a downloadable PDF artifact (`@react-pdf/renderer`, D4).
- [ ] The memo visibly declines to invent causes ("needs review", enforced by C1).
- [ ] Every risk flag shows a dollar impact.

---

## 10. Scope discipline

**Do not build (from the spec, confirmed):** auth first, billing, full company settings, ten real integrations, ML forecasting, a chatbot as the main product, anything that reads as generic analytics. The value is the governance workflow ending in the memo.

**Deferred non-goals, recorded with their trigger (per methodology, always record the decision even when building nothing):**

| Item | Decision | Trigger that would change it |
|---|---|---|
| Database / persistence (Supabase) | Not in v1 (D2). | A feature genuinely needs data to survive a session (for example shareable saved memos, or multi-session uploads). |
| Auth and multi-tenancy | Not in v1 (D1). | Decision to turn the demo into a real multi-user product. |
| Second and further provider parsers | Not in v1; Anthropic only (D5). | After launch, when a second real export source is available and wanted. |
| Friendly-company anonymized dataset | Not in v1 (D9). | A willing company and a clean anonymization path post-launch. |
| n8n scheduled monthly memo runs | Out of MVP (spec §10). | After the manual memo path is proven and persistence exists. |
| Duplicate / near-identical prompt detection | Out of MVP (spec §6). | Availability of prompt-level data. |
| Business-day pacing as default | Off by default; calendar default with a one-line switch (D13). | A user explicitly prefers business-day pacing. |

---

## 11. Where it is heading next (roadmap intent)

Direction only, not commitments. v1 is the single-tenant demo. The cheapest plausible path to "real product" later is: add Supabase plus auth (D1/D2 triggers), turn the in-browser compute into a thin per-user data layer over the same pure functions, add the second provider parser (D5), and add n8n scheduled monthly memo runs (spec §10). None of this is built now, and v1 is designed so unlocking it does not require rewriting the deterministic core.

---

## 12. Human-gates (only the human does these, per methodology §4)

- Set the **Claude API key** as an env var on Vercel. Code reads it; the value is set by the human.
- Confirm the **pricing data values** seeded into the pricing table before the methodology page presents them as authoritative (these are a product/business input).
- No destructive database gates exist in v1, because there is no database.

---

## 13. Proposed batch sequence (direction for BATCH_PLAN.md)

Sequenced by impact and dependency, mirroring the spec's quality-gated phases. This is direction for the fresh session that generates `BATCH_PLAN.md`, not the plan itself.

0. **Setup batch:** scaffold Next.js on Vercel, install dependencies (Tremor, Recharts, Papa Parse, `@react-pdf/renderer`, Claude SDK), verify build and lint run clean on the untouched tree, stand up the deterministic compute module skeleton with its test runner passing. Toolchain is proven before any feature.
1. **Static credible demo:** landing plus dashboard plus a precomputed memo on the canonical Northstar sample data. Done when a stranger understands the product in 10 seconds and sees a real-looking memo.
2. **Real ingestion:** canonical CSV upload, the Anthropic Console parser, the pricing-table cost derivation with reconciliation (D10/D11), and the actor-to-team mapping (D14). Done when the builder's own real export drops in and the dashboard is correct.
3. **Budget and forecast engine:** budgets by dimension; variance, pace, projection, scenarios, and the forecast guards (D13), all in pure functions. Done when numbers reconcile against a hand-check on the sample data.
4. **Waste/risk plus AI memo:** quantified flags with model-tier repricing (D12), the live serverless memo route, and both controls (C1, C2) implemented with their tests. Done when the memo is accurate, names only supported drivers, and marks gaps "needs review".
5. **Export and share:** PDF export (D4), copy-to-clipboard, sample CSV download, public demo link, short demo video. Done when you would be proud to put the link in a job application.

The setup batch and batch 1 must not be run in the same session.

---

## 14. Onboarding read order (once the pack exists)

`DECISIONS.md`, then `SESSION_LOG.md`, then `BATCH_PLAN.md`. Consult `DISCOVERY.md` (this file) for product intent when a batch touches it. Read the control matrix (§8) before touching the metrics layer or the memo route. `CLAUDE.md` is auto-loaded.

---

*End of DISCOVERY v1.0.*
