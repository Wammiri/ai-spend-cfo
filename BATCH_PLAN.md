# BATCH_PLAN: AI Spend CFO

**Version:** 1.0
**Date:** 2026-06-09
**Source:** DISCOVERY.md §13 (proposed batch sequence), sequenced by impact and dependency.
**Status:** B0 complete (toolchain proven, genesis commit made locally). Next batch to run is B1. Pending human: git remote + push, Vercel deploy, and the B1 Tremor decision (D22).

House rule observed: no em dashes.

One batch, one fresh session. Each batch lists the exact files it may touch and touches nothing else (exception: a renamed shared function pulls its call sites into the same batch). State which rung of the verification ladder was used in SESSION_LOG.md. The pack-generation batch (B-pack) and the scaffold batch (B0) are separate sessions; B0 and B1 must not share a session (DISCOVERY §13).

---

## Status board

| Batch | Name | Status | Depends on |
|---|---|---|---|
| B-pack | Pack generation | Done (2026-06-09) | DISCOVERY.md |
| B0 | Scaffold + toolchain proof | Done (2026-06-09); Vercel deploy + remote pending human | B-pack |
| B1 | Static credible demo | Not started (next) | B0 |
| B2 | Real ingestion | Not started | B0 (uses B1 UI shell) |
| B3 | Budget and forecast engine | Not started | B2 |
| B4 | Waste/risk + AI memo | Not started | B3 |
| B5 | Integrate finance-report-pdf skill | Not started | B4, and the skill authored separately |
| B6 | Export and share | Not started | B5 |

Side quest (not in the AI Spend CFO sequence): author the global `finance-report-pdf` skill (Typst), per `FINANCE_PDF_SKILL_DISCOVERY.md`. B5 depends on it existing.

---

## Skills woven into the build (D19, D20, D21)

This is a skill-driven build, not a generic one. Each batch invokes the skill(s) that raise its quality ceiling. Skills are tooling, not product dependencies, so they add no new packages.

| Skill | Where it is used | What it raises |
|---|---|---|
| `frontend-design` | B1, B6 | All UI craft: landing, dashboard, memo view, methodology page, export surface. Design language is institutional finance with modern execution (D20). Avoids the generic AI-dashboard look. |
| `claude-api` | B2 (Haiku classification), B4 (memo route) | Correct, current Anthropic SDK usage: model IDs, tool use, token counting, caching. Keeps the AI layer right rather than coded from memory. |
| `write-a-skill` | side quest (then B5 consumes it) | Authors the global `finance-report-pdf` skill (Typst, D21) to a JP Morgan craft bar, reusable across all Aperio products. Built in its own session per `FINANCE_PDF_SKILL_DISCOVERY.md`, not inside the AI Spend CFO sequence. |
| `security-review` | B2, B4 | Adversarial pass on untrusted upload parsing (B2) and the server memo route plus prompt-injection from uploaded data (B4). |
| `code-review`, `simplify` | every batch, pre-push | Correctness and cleanup pass before each commit. |
| `verify`, `run` | B1, B2, B6 | Drive the real app and observe behavior for the rung 3 and rung 4 checks; capture the hero screenshot. |

---

## Proposed file layout (reference for bounded file lists)

Batch B0 creates this skeleton. Later batches reference these paths. B0 may adjust exact filenames as it scaffolds and records any change in DECISIONS.md (D17).

```
ai_spend_cfo/
  package.json, tsconfig.json, next.config.mjs, .eslintrc.json, .env.example
  app/
    layout.tsx
    page.tsx                       landing
    dashboard/page.tsx
    methodology/page.tsx           "how cost is calculated" + honesty stance
    memo/page.tsx                  memo view (or a section of dashboard)
    api/memo/route.ts              the only server code: live upload memo (D3)
  lib/
    types.ts                       canonical usage schema + pricing types (DISCOVERY §7)
    pricing/pricing-table.ts       seeded pricing with effective_date (D11)
    metrics/
      cost.ts                      cost derivation + reconciliation (D10)
      budget.ts                    pace, expected, variance, status (D13 guards)
      forecast.ts                  run-rate, recent-trend, scenarios
      risk.ts                      quantified flags + tier repricing (D12)
      eligibility.ts               C1: partition eligible vs needs-review
      aggregate.ts                 load-time aggregations for KPIs/charts
      index.ts
    parsers/
      canonical-csv.ts             Papa Parse of the canonical CSV
      anthropic-console.ts         Anthropic Console export parser (D5)
    mapping/actor-team.ts          actor -> team/workflow/env/project/value_tag (D14)
    memo/
      build-inputs.ts              assemble computed inputs for the prompt
      prompt.ts                    memo prompt (spec §7 structure)
      validate.ts                  C2: number-integrity post-validation
    pdf/                           typst.ts runtime integration (D21): bundles the finance-report-pdf template + theme + fonts, renders the memo via wasm
  data/
    northstar.json                 synthetic sample, source=synthetic, labeled
    own-spend.csv                  builder's real spend, source=real (D9)
    sample-anthropic-export.csv    real export fixture for the parser (D5)
    precomputed-memo.json          cached hero memo content, canonical schema (D3)
    precomputed-memo.pdf           committed hero PDF, generated once by the finance-report-pdf skill (D21)
    sample-canonical.csv           downloadable sample CSV
  components/                      dashboard, KPI cards, charts, memo view, upload, mapping editor
  __tests__/ or co-located *.test.ts

# The finance-report-pdf skill is GLOBAL (~/.claude/skills/finance-report-pdf/), not in this repo (D21).
# AI Spend CFO consumes it; it does not own it. See FINANCE_PDF_SKILL_DISCOVERY.md.
```

---

## B0: Scaffold + toolchain proof

- **Status:** Done (2026-06-09). Build, lint, typecheck, and tests green on the untouched tree; genesis commit made on `main` (not pushed). Toolchain choices recorded in D22. Remaining: human-only Vercel deploy + remote/push (D18), and the B1 Tremor decision (D22).
- **Depends on:** B-pack.
- **Goal:** Stand up Next.js on Vercel, install the approved dependencies, prove the toolchain, and create the deterministic compute skeleton with a passing test runner. Toolchain is proven before any feature.
- **Done when:** `next build` and the linter run clean on the untouched tree; the test runner is installed and passes on a trivial seed test; a deployable empty app is live on Vercel.
- **Files to touch:** `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `.env.example`, `app/layout.tsx`, `app/page.tsx` (placeholder), `lib/types.ts` (schema types only), `lib/metrics/index.ts` (empty skeleton), one seed test, README scaffold note. Initialize git and make the first commit of the pack plus scaffold.
- **Verification rung:** rung 1 (build + lint clean) plus the test runner passing on an untouched tree. Calibrate lint so the scaffold passes.
- **Dependencies to install (approved set only, pinned):** `next`, `react`, `react-dom`, `typescript`, `@tremor/react`, `recharts`, `papaparse`, `@anthropic-ai/sdk`, plus the chosen test runner. PDF is NOT a B0 dependency: `@react-pdf/renderer` is dropped (D21), and the `typst.ts` runtime is added at B5 when the `finance-report-pdf` skill is integrated. Any addition beyond this set is a decision recorded in DECISIONS.md first.
- **Flags / human gates:** add `ANTHROPIC_API_KEY` to `.env.example` (value set by the human on Vercel later, before B4). Choose the git remote (human) and confirm the Vercel project. D18 is resolved here.

## B1: Static credible demo

- **Status:** Not started (next).
- **Depends on:** B0.
- **Goal:** Landing plus dashboard plus a precomputed memo on the canonical Northstar sample data. The hero loads instantly from the cached memo (D3), with no AI call on the sample path.
- **Done when:** a stranger understands the product in 10 seconds on the landing page and sees a real-looking memo; Northstar is labeled "sample" everywhere (credibility checklist).
- **Files to touch:** `app/page.tsx`, `app/dashboard/page.tsx`, `app/memo/page.tsx`, `components/*` (KPI cards, charts, memo view, sample-data banner), `data/northstar.json`, `data/precomputed-memo.json`, `lib/metrics/aggregate.ts` (read-only aggregations for display).
- **Skills:** `frontend-design` builds every surface to the institutional-finance-with-modern-execution brief (D20); `run` and `verify` drive the app and capture the hero screenshot.
- **Verification rung:** rung 3 (behavioral/UI check with Playwright or equivalent): landing renders, dashboard renders the Northstar numbers, memo view renders the cached memo, sample labeling is present.
- **Flags / human gates:** none new. The precomputed memo content is generated once and committed; if it uses a live call to produce, that is a one-time build step, not a per-visit call.

## B2: Real ingestion

- **Status:** Not started.
- **Depends on:** B0 (uses the B1 UI shell for the upload surface).
- **Goal:** Canonical CSV upload, the Anthropic Console parser (D5), pricing-table cost derivation with reconciliation (D10/D11), and the actor-to-team mapping (D14). Ship the "how cost is calculated" methodology page.
- **Done when:** the builder's own real Anthropic export drops in, normalizes to the canonical schema, derives cost, reconciles against any reported cost, and the dashboard is correct on real numbers (Tier-1 anchor + Tier-2 parse, two credibility-checklist boxes).
- **Files to touch:** `lib/parsers/canonical-csv.ts`, `lib/parsers/anthropic-console.ts`, `lib/pricing/pricing-table.ts`, `lib/metrics/cost.ts`, `lib/mapping/actor-team.ts`, `lib/types.ts` (if schema needs a field), `app/methodology/page.tsx`, `components/*` (upload control, mapping editor, reconciliation display), `data/own-spend.csv`, `data/sample-anthropic-export.csv`, `data/sample-canonical.csv`, and the matching `*.test.ts` for parser and cost.
- **Skills:** `claude-api` for the Haiku value-tag classification call (D6); `security-review` on the untrusted upload parsing; `verify` on the live real-export end-to-end.
- **Verification rung:** rung 2 for parser and cost-derivation logic (targeted + regression), rung 3 for the upload UI, and rung 4 (live end-to-end) with the real Anthropic export as the credibility proof.
- **Flags / human gates:** confirm the seeded pricing values before the methodology page presents them as authoritative (DISCOVERY §12). Reconfirm the exact Anthropic Console export format before finalizing the parser (D5, pending reconfirm).

## B3: Budget and forecast engine

- **Status:** Not started.
- **Depends on:** B2 (needs normalized rows and derived cost).
- **Goal:** Budgets by dimension (department / workflow / model / project / environment); variance, pace, projection, scenarios, and the forecast guards (D13), all in pure functions.
- **Done when:** numbers reconcile against a hand-check on the sample data; early-month and no-budget cases produce honest labels, not false overruns.
- **Files to touch:** `lib/metrics/budget.ts`, `lib/metrics/forecast.ts`, `lib/metrics/aggregate.ts` (budget-vs-actual aggregation), `components/*` (budget-vs-actual, forecast scenario views), `data/northstar.json` (add budgets if modeled in data), and `budget.test.ts`, `forecast.test.ts`.
- **Verification rung:** rung 2 (pure logic, targeted + regression) plus a documented hand-check of the sample-data totals. No behavioral check needed for pure math.
- **Flags / human gates:** none new. Business-day pacing stays off by default behind the one-line switch (D13).

## B4: Waste/risk + AI memo

- **Status:** Not started.
- **Depends on:** B3 (the memo consumes budgets, forecast, and flags).
- **Goal:** Quantified waste/risk flags with model-tier repricing (D12), the live serverless memo route (D3), and both controls (C1 eligibility partition, C2 number-integrity) implemented with their tests.
- **Done when:** the memo is accurate, names only supported drivers, marks thin-data causes "needs review" and excludes them from recommendations, every flag shows a dollar impact, and no unsupported figure survives in the output.
- **Files to touch:** `lib/metrics/risk.ts`, `lib/metrics/eligibility.ts` (C1), `lib/memo/build-inputs.ts`, `lib/memo/prompt.ts`, `lib/memo/validate.ts` (C2), `app/api/memo/route.ts` (rate-limited, key server-side), `components/*` (generate-memo control, risk view), and `risk.test.ts`, `eligibility.test.ts` (C1 golden), `validate.test.ts` (C2).
- **Skills:** `claude-api` governs the memo route (model IDs, SDK patterns, tool use, token counting, caching); `security-review` covers the server route and prompt-injection risk from uploaded data; `code-review` pre-push.
- **Verification rung:** rung 2 for flags and the two control functions (golden test for C1: thin-data driver never reaches recommendations; C2 test: no unsupported figure survives); rung 4 (live end-to-end) for the memo route against the real Claude API. Prove both the allowed and the forbidden case for each control.
- **Flags / human gates:** `ANTHROPIC_API_KEY` must be set by the human on Vercel before this runs live. The route must be rate-limited and never expose the key client-side. Scan the diff for secrets before push.

## B5: Integrate the finance-report-pdf skill

- **Status:** Not started.
- **Depends on:** B4 (the memo content and its computed inputs exist) AND the global `finance-report-pdf` skill having been authored (separate side quest, see `FINANCE_PDF_SKILL_DISCOVERY.md`).
- **Goal:** Consume the global `finance-report-pdf` skill (Typst, D21) to produce the committed hero memo PDF, and wire the live "Download PDF" path so an uploaded-data memo renders the same Typst template at runtime via `typst.ts` (wasm). Map the app's computed memo content into the skill's canonical document schema.
- **Done when:** the precomputed hero PDF (`data/precomputed-memo.pdf`) is committed and board-grade; the live runtime renders a real PDF from an uploaded-data memo in the same house style; every figure in the PDF traces to the app's computed numbers (the skill never computes).
- **Files to touch:** `lib/pdf/` (typst.ts runtime integration: bundle the template, theme, and fonts; map memo content to the canonical schema), `lib/memo/build-inputs.ts` (emit the schema JSON if not already), `data/precomputed-memo.json`, `data/precomputed-memo.pdf` (generated, committed), `package.json` (add `typst.ts`). No change to the global skill from here; it is consumed, not edited.
- **Skills:** the `finance-report-pdf` skill itself (invoked to generate the hero PDF); `verify` on the runtime PDF path.
- **Verification rung:** rung 3 (behavioral: hero PDF renders and is correct; live runtime produces a PDF from an uploaded-data memo) plus a trace check that no figure in the PDF is absent from the supplied content.
- **Flags / human gates:** the global skill must exist first. Confirm the `typst.ts` wasm bundle size is acceptable for the client-side download path (the recommended runtime, kept client-side so the hero never depends on a server function).

## B6: Export and share

- **Status:** Not started.
- **Depends on:** B5.
- **Goal:** Wire PDF export through the B5 skill components, copy-to-clipboard, sample CSV download, public demo link, and a short demo video. Close the credibility checklist (DISCOVERY §9).
- **Done when:** the memo produces a board-made downloadable PDF (B5 house style), copy works, the sample CSV downloads, the public link is live, and you would be proud to put the link in a job application.
- **Files to touch:** `components/*` (export buttons, copy, sample-CSV download), `data/sample-canonical.csv` (finalize), landing/demo polish in `app/page.tsx`. Reuses `lib/pdf` from B5; does not redefine the PDF. The demo video is produced by the human.
- **Skills:** `frontend-design` for the export-surface polish; `verify` and `run` for the end-to-end and the public deploy check.
- **Verification rung:** rung 3 (behavioral: PDF download, copy, sample CSV) plus rung 4 (the public Vercel deploy is live and the full sample-to-memo-to-PDF path works end to end).
- **Flags / human gates:** the demo video and the launch post are human deliverables. Confirm the public link is the intended distribution asset.

---

## Session prompt template (copy at the start of each execution session)

```
Read the onboarding files first: DECISIONS.md, SESSION_LOG.md, BATCH_PLAN.md.
Consult DISCOVERY.md for product intent if this batch touches it.
Read the control matrix (DISCOVERY §8) before touching the metrics layer or the memo route.

[Any decisions or status not yet in the files, stated explicitly.]

Batch: [ID]
Tasks: [what this batch delivers]
Files to touch, only these: [paths from this plan]. Call sites of any renamed shared function included.

Follow the protocol: bounded file list, the verification ladder (state which rung),
build and lint before commit, one commit per task as type(scope): ID description,
push at the end, update SESSION_LOG and BATCH_PLAN status.

Stop before any destructive or production change and flag me.
Flag any new env var for me to set. Label any legal or policy text DRAFT.
For any ambiguity, pick a sensible default, isolate it as a one-line switch, and flag it.

One batch only. Stop and report when done or paused.
```
