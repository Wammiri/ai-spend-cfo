# CLAUDE.md: AI Spend CFO

Project operating rules. Auto-loaded every session. The global building methodology at `~/.claude/building-methodology.md` governs HOW we build; this file governs WHAT this project is and the rules specific to it. When the two ever appear to conflict, the methodology wins on process and this file wins on product facts.

House rule, enforced everywhere including generated product content: no em dashes. Use periods, commas, colons, or parentheses. En dashes only for date ranges. Enforce it deterministically on product output (strip on render), not by asking the model to remember.

---

## Identity

AI Spend CFO is the FP&A layer for AI spend. It turns raw AI usage logs into budget variance, spend forecasts, waste detection, and a CFO-ready control memo. Shipped under the Aperio Finance umbrella, product name "AI Spend CFO" (D7).

Positioning: AI cost governance for finance, not AI analytics for engineering. The mental model is governance (budgets, variance, ownership, controls), never monitoring (observability dashboards). The line: "FinOps tools tell engineers what they spent. Nobody gives finance a way to govern it. That is this."

The hero is the CFO memo. Dashboards and charts are table stakes. Every screenshot, demo, and launch post leads with the memo, not the charts.

Weight class: light (DISCOVERY §2). Portfolio / credibility artifact, single-tenant public demo. No auth, no multi-tenancy, no database, no billing in v1 (D1, D2). Heavy only on the two things that are the moat: data credibility (real own-spend plus one real provider parser plus honest labeling) and memo quality/honesty (the board-ready artifact with code-enforced truth).

Success test for every tradeoff: a finance leader or a hiring manager is convinced in under 60 seconds, and the memo is the proof. Optimize for that, not for "a stranger can sign up and run their company on it."

---

## Architectural laws (do not violate)

1. Deterministic code computes every number. The AI never calculates. All totals, variances, forecasts, and savings are produced by code from the data. The AI receives already-computed numbers and turns them into language, narrative, and recommendations.
2. The AI flags gaps rather than inventing causes. Where a cause is not supported by the data, it is marked "needs review" and excluded from recommendations.

Both laws are made enforceable via the control matrix (DISCOVERY §8, controls C1 and C2), not left as prose.

---

## The AI layer boundary

Allowed (judgment / language): generate the memo; explain variance drivers from given numbers; summarize risk flags; recommend controls; classify workflows into value tiers; translate dashboard findings into executive language.

Forbidden (computation / truth): computing any total, variance, forecast, or savings; inventing a cause not supported by the data; asserting a number that was not supplied to it.

Memo model: Opus-class (quality is the differentiator, volume is low). Value-tag classification model: Haiku (cheap, simple classification only). The memo prompt receives only computed inputs (summary metrics, budget table, ranked cost drivers, risk flags with dollar impact and recommendation, forecast scenarios) and is instructed to use only those, to mark unsupported causes "needs review" and exclude them, and to never compute or restate a number it was not given.

---

## Tech stack (D16, D21, D23)

- Next.js (App Router) on Vercel. The single serverless route at `app/api/memo/route.ts` handles the live upload memo with the API key held server-side and rate limiting.
- TypeScript throughout.
- Tailwind CSS for styling. The dashboard and every UI surface are built with the `frontend-design` skill to the institutional-finance-with-modern-execution brief (D20), on Tailwind. `@tremor/react` is dropped (D23): it was stale (last published 2025-01-13, a React-18 peer) and forced a legacy-peer-deps override. We build the cards and chart wrappers directly instead, for full control of the D20 look.
- Recharts (direct) for charts.
- Papa Parse for CSV.
- PDF via the global `finance-report-pdf` skill (Typst engine), integrated at B5: dev-time generates the committed hero memo PDF, the live "Download PDF" renders the same template at runtime via `typst.ts` (wasm). `@react-pdf/renderer` and jsPDF are both dropped (D21, D4).
- Anthropic SDK for the memo and the value-tag classification calls.
- Vitest for the deterministic compute tests; Playwright for behavioral / UI checks (D24, installed at B0.5).
- No database in v1. Sample data ships as bundled static JSON/CSV. Uploads are parsed in-browser, computed in pure functions, rendered, and exported. Nothing persists (D2).

A dependency is a decision (methodology §5). The approved product set is Tailwind CSS, Recharts, Papa Parse, the Anthropic SDK, and (at B5) the Typst runtime for the PDF skill; Vitest and Playwright are the test and verification tools. Anything else is justified, checked for maintenance, pinned, and recorded in DECISIONS.md before it is added. The default answer to a new dependency is no.

---

## Conventions

- All numbers come from pure functions in `lib/metrics`. The UI and the memo route consume their output; they never recompute.
- The canonical usage schema (DISCOVERY §7) is the single internal shape. Every parser maps INTO it. Every row carries `source` (real / provider-export / synthetic) for honest labeling.
- `cost_usd` is always re-derived from the pricing table as the source of truth, even when an export reports a dollar cost. The reported cost is stored and shown as a reconciliation delta; divergence beyond a threshold is flagged (D10).
- Pricing rows carry `effective_date`. For any event, select the latest row with `effective_date <= event date` (D11). The methodology page shows "prices as of …".
- Scale assumption: up to roughly 50k canonical rows computed in-browser, aggregated on load. No pagination, no server-side compute (D15).
- Synthetic Northstar data is labeled "sample" everywhere it appears. Real data (the builder's own spend) is labeled real. Never present synthetic as real.
- Forecast guards (D13): calendar-day pacing by default, business-day pacing exposed as a one-line switch. If `days_elapsed < 3`, label the forecast "early / low confidence", never an overrun. If a dimension has no budget, show "no budget set", never a false overrun.

---

## Control matrix (read before touching the metrics layer or the memo route)

- C1: "needs review" is decided in code, not by AI discretion. A pure function in the metrics layer partitions drivers and flags into eligible vs needs-review (minimum event count or dollar floor, non-null dimension) before the prompt is assembled. Golden test required: a thin-data driver never reaches recommendations.
- C2: memo number-integrity pass. The memo route computes all numbers, injects only those, then post-validates the model output so every dollar figure traces to a supplied input. Unsupported figures are flagged or stripped. Test required: no unsupported figure survives in the returned memo.

Full rows (risk, enforcement location, failure behavior, test) live in DISCOVERY §8. A control without an enforcement layer and a passing test is a wish.

---

## Human gates (only the human does these, DISCOVERY §12)

- Set `ANTHROPIC_API_KEY`. Code reads it; the human sets the value. For local dev, copy `.env.example` to `.env.local` (gitignored) and put the key there. For production, set it in the Vercel project under Settings, Environment Variables (not a file). Needed before Batch B4.
- Confirm the seeded pricing data values before the methodology page presents them as authoritative (a product/business input). Needed before Batch B2 ships the methodology page.
- Choose and connect the git remote (a business decision). Once connected, Vercel auto-deploys on push. Set up at B0.5.
- No destructive database gates exist in v1, because there is no database.

---

## Onboarding read order, every session

DECISIONS.md, then SESSION_LOG.md, then BATCH_PLAN.md. Consult DISCOVERY.md for product intent when a batch touches it. Read the control matrix (DISCOVERY §8) before touching the metrics layer or the memo route. This file is auto-loaded.

---

## Per-batch discipline (from the methodology)

One batch, one fresh session. Touch only the files the batch lists in BATCH_PLAN.md. Match the verification ladder rung to the change: every batch that ships or changes UI gets a Playwright behavioral check (Playwright is the standing harness, installed at B0.5); a pure-logic batch proves itself at the logic/regression rung with Vitest (do not drive a browser for pure math). For anything permission- or honesty-gated, a check is not done until it proves both the allowed case and the forbidden one. Build and lint before commit. Scan the diff for secrets before pushing. One commit per task as `type(scope): ID description`. Commit AND push to the remote at the end of every batch: a batch is not complete until it is pushed (Vercel then auto-deploys). Update SESSION_LOG.md and BATCH_PLAN.md status. Stop after one batch; do not chain into the next.
