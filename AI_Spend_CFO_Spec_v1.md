# AI Spend CFO — Build Spec v1.0

> **What this document is:** a build-ready specification for a portfolio-grade product.
> It is written to be fed to an AI build process incrementally. Build in the order given,
> respect the quality gates, and do not skip the data-credibility work — that is the moat.

---

## 0. The one-liner

**AI Spend CFO is the FP&A layer for AI spend.** It turns raw AI usage logs into budget
variance, spend forecasts, waste detection, and a CFO-ready control memo.

Tagline options (pick one for the site, keep the rest for posts):
- "The FP&A layer for AI spend."
- "Finance-grade controls for AI usage."
- "Govern AI spend before it becomes the next cloud-cost mess."

---

## 1. The insight (the actual asset)

The product is downstream of one true observation. Lead with it everywhere:

> **AI spend is becoming operational spend — but almost nobody is managing it with
> finance-grade controls yet.** Usage-based cost is spreading across teams (Claude, ChatGPT,
> Cursor, Gemini, n8n agents, internal copilots) faster than finance can track ownership,
> budget, value, and waste. Finance sees the bill *after* the spend has happened.

This is the thing people will repost. The tool is the payoff to the insight, not the headline.

---

## 2. Positioning — aim at FINANCE, not engineering

This is the difference between drowning in a crowded space and owning a gap.

| | Existing FinOps / AI-cost tools | AI Spend CFO |
|---|---|---|
| **Built for** | Platform / engineering teams | Finance / FP&A / the CFO |
| **Primary question** | "What did we spend on infra?" | "Are we on budget, who owns it, what's wasteful, what do we do?" |
| **Output** | Observability dashboards | Budget variance + forecast + control **memo** |
| **Mental model** | Monitoring | **Governance** |

> **The line to use:** "FinOps tools tell engineers what they spent. Nobody gives *finance*
> a way to govern it — with budgets, variance, ownership, and controls. That's this."

Do **not** position it as "AI analytics" or "an AI usage dashboard." Position it as
**AI cost governance for finance teams.**

---

## 3. The core principle (architectural law — do not violate)

> **Deterministic code computes every number. The AI never calculates — it explains,
> classifies, and recommends.**

- All totals, variances, forecasts, and savings estimates are produced by code from the data.
- The AI receives *already-computed* numbers and turns them into language, narrative, and
  recommendations.
- The AI is explicitly instructed to **flag gaps rather than invent causes** (see §9).

Why this matters: it is what makes the product signal *finance judgment and control*
instead of "a chatbot over a spreadsheet." It is also a quiet credibility flex — the same
principle a serious finance person would demand. State it openly on the methodology page.

---

## 4. The hero: the CFO memo

Everything else (dashboards, charts) is table stakes — every competitor has them. **The
board-ready narrative is the differentiator and the part that showcases *you*.** Lead every
screenshot, demo, and launch post with the memo, not the charts.

The memo is the destination of the whole workflow:

```
usage logs → normalized cost → budget variance → forecast → waste/risk → CONTROL MEMO
```

### Example memo output (the thing you screenshot)

> **AI Spend Review — June 2026**
>
> AI spend is projected to close at **$3,420** against a monthly budget of **$2,800**, a
> projected overrun of **$620 (+22%)**.
>
> The main driver is **Marketing**, forecast to exceed budget by $370 due to increased
> campaign content generation and repeated use of higher-cost models. **Product** generated
> ~$214 of avoidable spend using advanced models for low-complexity internal documentation.
>
> **Finance** usage remains efficient: ~18% of total spend, almost all tied to high-value
> workflows (board memos, variance analysis, forecast commentary).
>
> **Recommended controls:**
> 1. Route low-complexity workflows to cheaper models (est. saving ~$214/mo).
> 2. Require approval for any workflow projected above $100/mo.
> 3. Add per-department budget caps.
> 4. Review all low-value workflows above $50/mo.
> 5. Separate budgets for experimentation vs. production workflows.
>
> *Items marked "needs review" lack sufficient data to assign a cause and are excluded from
> the recommendations above.*

That last line is deliberate — it demonstrates the honesty stance from §3 and §9.

---

## 5. Data strategy (the biggest upgrade — read carefully)

A demo on pure fake data reads as a mockup and gets mentally filed as "nice concept."
Credibility comes from **real data somewhere** plus **one real ingestion path**. Use three
tiers, and **label honestly** which is which.

### Tier 1 — Your own real spend (the credibility anchor)
Track a month of *your actual* AI tool spend (Claude, ChatGPT, Cursor, etc.). Even as a
single user, "I tracked a month of my own AI spend and built a finance system to govern it"
is a story that cannot be dismissed as a mockup — and the launch post writes itself.

### Tier 2 — One real provider export parser (the "it actually works" proof)
Ingest **one real export format** end-to-end. Pick the one you use most:
- **Anthropic Console** usage/cost export
- **OpenAI** usage / billing export
- **Google AI Studio / Vertex** export

The real-world hard problem (which the product *solves*): every provider exports a different
shape, and **exports often give tokens, not dollars**. So cost must be **derived** from a
pricing table (see below). One real connector beats ten fake ones.

### Tier 3 — Clearly-labeled synthetic (to tell the multi-department story)
Generate realistic synthetic data for the fictional **Northstar AI Labs** to show the
multi-team narrative. Mark it visibly as "sample data." Never present synthetic as real.

### The normalization layer (the real engineering insight)
Every source maps INTO one **canonical usage schema**. The product's job is normalization.

**Canonical usage event** (one row = one aggregated usage record):

| Field | Type | Source / notes |
|---|---|---|
| `date` | date | from export |
| `actor` | string | user / email / API-key label |
| `team` | string | department; mapped from actor or key |
| `workflow` | string | use-case label |
| `provider` | string | Anthropic / OpenAI / Google / … |
| `model` | string | normalized model id |
| `input_tokens` | int | from export |
| `output_tokens` | int | from export |
| `cached_input_tokens` | int | optional; cheaper — real exports include it |
| `requests` | int | from export |
| `cost_usd` | decimal | **derived** if not present (see pricing) |
| `value_tag` | enum(high/med/low) | **assigned**, not from provider (see below) |
| `approval_status` | enum(approved/unapproved) | assigned |
| `environment` | enum(prod/experiment) | assigned; powers the exp-vs-prod budget split |
| `project` | string | owner / client; nullable → drives "missing owner" flag |

**Pricing table** (drives deterministic cost derivation):

| Field | Notes |
|---|---|
| `provider`, `model` | key |
| `input_price_per_1m` | USD per 1M input tokens |
| `output_price_per_1m` | USD per 1M output tokens |
| `cached_input_price_per_1m` | optional |
| `effective_date` | prices change; version them |

**Cost derivation (deterministic):**
```
cost_usd = input_tokens/1e6 * input_price_per_1m
         + output_tokens/1e6 * output_price_per_1m
         + cached_input_tokens/1e6 * cached_input_price_per_1m
```

**On `value_tag`:** the provider never tells you business value. Assign it by:
1. a rule-based map (workflow → value tier) as the default, or
2. **AI classification** of the workflow description into a tier — a *legit* AI use
   (classification, not computation). Keep the mapping editable by the user.

---

## 6. MVP modules

Six modules. The memo (Module 6) is the destination — build toward it.

### Module 1 — Ingestion & normalization
- Default to sample data (no login for the demo).
- Inputs: sample dataset | upload canonical CSV | upload one real provider export.
- Normalize → canonical schema → derive cost via pricing table.
- Provide a downloadable sample CSV and a visible "how cost is calculated" note.

### Module 2 — Spend dashboard ("AI Spend Control Dashboard")
**Top KPIs:** total spend, MTD spend, budget used %, forecast month-end, variance to budget,
cost per request, high-risk spend, unapproved spend, waste estimate.
**Charts:** spend by department / workflow / model, daily spend trend, budget vs actual,
forecast scenarios, cost by value tag, approved vs unapproved.

### Module 3 — Budget vs actual (this is where it becomes FP&A)
Set monthly budgets by department / workflow / model / project / environment. Then:
```
pace              = days_elapsed / days_in_month
expected_to_date  = budget * pace
variance_to_date  = actual_to_date − expected_to_date
projected_spend   = run-rate forecast (see §7)
projected_variance= projected_spend − budget
budget_used_pct   = actual_to_date / budget
status            = healthy | at risk | overrun   (thresholds, e.g. ±10% / >100%)
```

### Module 4 — Waste & risk detection (the memorable layer)
Each flag must **quantify impact in dollars**, because "$640 avoidable spend" is the
shareable number.

| Flag | Logic | Impact ($) |
|---|---|---|
| Expensive-model misuse | low-value/low-complexity workflow on a top-tier model | `current_cost − repriced_at_cheaper_tier` |
| Low-value spend | `value_tag = low` | sum of those costs |
| Unapproved spend | `approval_status = unapproved` | sum |
| Budget overrun (early) | `projected_variance > 0` and pace high | projected overrun |
| Usage spike | day's spend > N× trailing-7-day avg (e.g. 3×) | spike delta |
| Missing owner | `project` is null | sum of ownerless cost |

Define **model tiers** for the misuse flag: e.g. *frontier* (Opus, GPT-4-class) / *mid*
(Sonnet, mini) / *cheap* (Haiku, open). Savings = current cost − tokens repriced at the
recommended cheaper tier. *(Stretch: duplicate/near-identical prompt detection — needs
prompt-level data; mark out of MVP.)*

### Module 5 — Forecasting (keep it simple, show the formula)
Three methods, all deterministic:
1. **Run-rate:** `avg_daily_spend_to_date × days_in_month`
2. **Recent-trend:** `avg_daily_spend_last_7d × days_remaining + actual_to_date`
3. **Scenario:** base (run-rate) / upside (+25% usage) / control (low-value workflows −30%)

*(Optional realism: pace on business days only. Note the assumption; don't over-engineer.)*

### Module 6 — CFO memo generator (the hero)
Button: **Generate CFO Memo** → produces executive summary, budget performance, cost
drivers, waste/risk, recommended controls, questions for owners. Export to PDF + copy.
The AI receives only computed numbers (see §9).

---

## 7. The AI layer — what it may and may not do

**Allowed (judgment / language):** generate the memo; explain variance drivers from given
numbers; summarize risk flags; recommend controls; classify workflows into value tiers;
translate dashboard findings into executive language.

**Forbidden (computation / truth):** computing any total, variance, forecast, or savings;
inventing a cause not supported by the data; asserting facts without the underlying numbers.

### Memo prompt (structure)
```
You are a CFO-facing FP&A analyst. Use ONLY the data provided below.
Do not invent causes. If a cause is not supported by the data, mark it "needs review"
and exclude it from recommendations. Do not compute or restate any number that is not
given to you.

Write a concise AI spend review memo with:
1. Executive summary
2. Budget performance
3. Main cost drivers
4. Waste / risk areas
5. Recommended controls (each tied to an estimated $ impact from the data)
6. Questions for department owners

Data:
  {summary_metrics}        # totals, MTD, budget used %, forecast, variance
  {budget_table}           # per-dimension budget vs actual vs projected
  {cost_drivers}           # ranked departments/workflows/models by spend
  {risk_flags}             # each with $ impact and recommendation
  {forecast_scenarios}     # base / upside / control
```

This honesty stance ("needs review" instead of fabrication) is a deliberate differentiator —
call it out on the methodology page.

---

## 8. Data model (Supabase / Postgres)

```
ai_usage_events(id, date, actor, team, workflow, provider, model,
  input_tokens, output_tokens, cached_input_tokens, requests, cost_usd,
  value_tag, approval_status, environment, project, source, created_at)

pricing(id, provider, model, input_price_per_1m, output_price_per_1m,
  cached_input_price_per_1m, effective_date)

budgets(id, dimension_type, dimension_value, monthly_budget, month, environment, created_at)

risk_flags(id, flag_type, dimension_value, description, estimated_impact,
  severity, recommendation, created_at)

generated_memos(id, month, memo_text, total_spend, forecast_spend,
  budget_variance, created_at)
```
`source` distinguishes real / provider-export / synthetic for honest labeling.

---

## 9. Credibility checklist (the anti-mockup gate)

Before launch, every box must be true:
- [ ] At least one view runs on **real** numbers (your own spend).
- [ ] At least one **real provider export** parses end-to-end.
- [ ] Synthetic data is **labeled** as sample everywhere it appears.
- [ ] A **"how cost is calculated"** page shows the pricing table and formula.
- [ ] The memo produces a **downloadable PDF artifact**.
- [ ] The memo visibly **declines to invent causes** ("needs review").
- [ ] Every risk flag shows a **dollar impact**.

---

## 10. Tech stack

- **Frontend:** React
- **DB:** Supabase / Postgres
- **AI:** Claude API (memo, classification, explanations)
- **Charts:** Recharts or Tremor
- **CSV parsing:** Papa Parse
- **PDF export:** jsPDF
- **Deploy:** Vercel
- *(Later: n8n for scheduled monthly memo runs.)*

---

## 11. Build plan (quality-gated, not time-boxed)

You build deliberately, so these are **gates**, not weeks. Don't start a phase until the
prior one's "done" is true.

**Phase 1 — Static credible demo.**
Landing + dashboard + memo on the canonical sample data (Northstar).
*Done when:* a stranger understands the product in 10 seconds and sees a real-looking memo.

**Phase 2 — Real ingestion.**
Canonical CSV upload + one real provider-export parser + pricing-table cost derivation.
*Done when:* you can drop in your own real export and the dashboard is correct.

**Phase 3 — Budget & forecast engine.**
Budgets by dimension; variance, pace, projection, scenarios — all in code.
*Done when:* numbers reconcile and match a hand-check on the sample data.

**Phase 4 — Waste/risk + AI memo.**
Quantified flags; Claude-generated memo from computed metrics, with guardrails.
*Done when:* the memo is accurate, names only real drivers, and marks gaps "needs review."

**Phase 5 — Export & share.**
PDF export, copy-to-clipboard, sample CSV download, public demo link, short demo video.
*Done when:* you'd be proud to put the link in a job application.

---

## 12. Scope discipline — do NOT build

Auth first · billing · full company settings · 10 real integrations · ML forecasting ·
a chatbot as the main product · anything that makes it look like generic analytics.
**The value is the governance workflow, ending in the memo.**

---

## 13. Distribution — sell the insight, not the tool

**Launch post structure:**
1. State the pain (ideally with your *real* spend as proof).
2. Show the messy "before."
3. Show the workflow.
4. **Show the memo.**
5. End on the positioning: "The FP&A layer for AI spend."

**Hook line to test:** *"AI spend is the next shadow-IT cost problem — and finance has zero
controls for it. So I built the FP&A layer for AI spend."*

**Where:** LinkedIn (finance) primary; cross-post the insight to X. Target the people who
hire FP&A / finance-systems talent — the memo screenshot is your calling card.

---

## 14. Open decisions for you

1. **Which real provider export** do you parse first (matches what you actually use)?
2. **Value tagging:** rule-based map, AI classification, or both editable?
3. **Branding:** standalone product name, or shipped under **Aperio Finance** (adds your
   credibility; recommended)?
4. **Demo scope:** single-tenant public demo only, or add CSV upload at launch?
5. **Real-data depth:** just your own spend, or also one friendly small company's
   (anonymized) data for a richer multi-team story?

---

*End of spec v1.0.*
