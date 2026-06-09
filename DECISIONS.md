# DECISIONS: AI Spend CFO

**Version:** 1.0
**Date:** 2026-06-09
**Source:** DISCOVERY.md §5 (the grill output), §8 (controls), §10 (deferred non-goals), §12 (human gates).
**Status:** Seeded from discovery in the pack-generation session. Every decision made in conversation from here is written into this file before the next session begins.

House rule observed: no em dashes.

**Confidence legend:** `User-confirmed` (the user stated it), `Inferred-high` (a strong inference, reversible, recorded as such), `Inferred-medium` (a working assumption to reconfirm). Where a decision needs a later reconfirm, the trigger is named.

**Status legend:** `Active` (the decision stands), `Active / pending reconfirm` (stands but flagged for the human to confirm a detail), `Active / not yet implemented` is implied for all of these because no product code exists yet; the decision governs whichever batch implements it.

---

## 1. Foundation

### D1: Portfolio / credibility artifact, single-tenant, no auth, moat-first
- **Decision:** Build a single-tenant public demo optimized as a portfolio and credibility artifact. "Real multi-user product" is a deferred non-goal kept cheap to unlock, not built now.
- **Why:** The spec frames it as portfolio-grade and targets people who hire FP&A talent. The two goals (portfolio vs real SaaS) conflict on tradeoffs, and portfolio wins.
- **Traded off:** Generality and a sign-up path, in exchange for a hero that loads instantly and convinces in 60 seconds.
- **Confidence:** User-confirmed. **Status:** Active.

### D2: No database in v1
- **Decision:** Ship sample data as bundled static JSON/CSV. Uploads are parsed in-browser, computed in pure functions, rendered, and exported. Nothing persists. Supabase is added later only if a feature forces persistence, and is flagged at that point.
- **Why:** A DB adds migrations, secrets, RLS, and cold-starts that can break the hero during a 60-second visit, for no gain in a single-tenant demo. The canonical schema is demonstrated as code/types plus the methodology page, not by hosting Postgres.
- **Traded off:** Saved memos and multi-session state, in exchange for reliability and zero per-visit cost.
- **Confidence:** User-confirmed. **Status:** Active. **Trigger to revisit:** a feature genuinely needs data to survive a session (see deferred non-goals).

### D3: Hybrid memo generation
- **Decision:** Precompute and cache the sample-data memo (Northstar plus the builder's own spend) once, so the hero loads instantly, costs nothing per visit, and cannot fail or be abused. User uploads trigger a live Claude call via a rate-limited serverless route with the key held server-side.
- **Why:** Best of both: a perfect, reliable hero screenshot, and a provably-live pipeline on real uploaded data.
- **Traded off:** A small amount of build complexity (two paths) for reliability of the hero and proof of liveness.
- **Confidence:** User-confirmed. **Status:** Active.

### D4: Memo rendering and export
- **Decision:** A polished on-screen HTML/React memo is the screenshot hero. The downloadable PDF is produced with `@react-pdf/renderer`. jsPDF is dropped.
- **Why:** The on-screen memo is the real LinkedIn distribution asset; the PDF is a credibility checkbox that must look board-made. jsPDF fights layout and reads as developer-made. The new dependency is justified because the memo artifact is the differentiator.
- **Traded off:** A heavier PDF library, accepted because memo quality is the moat.
- **Confidence:** User-confirmed. **Status:** Active. Supersedes the spec §10 choice of jsPDF. The on-screen-memo-as-hero part is unchanged; the PDF generation mechanism is elevated to a bespoke authored skill by D21.

---

## 2. The spec's §14 open decisions, now resolved

### D5: First real provider export: Anthropic Console
- **Decision:** Parse the Anthropic Console usage/cost export as the first real provider export (Tier 2).
- **Why:** The builder uses Claude, so the real Tier-1 data and the Tier-2 parser exercise the same provider, closing the credibility loop fastest.
- **Traded off:** Breadth (OpenAI, Google) for depth on the one provider that backs the real data.
- **Confidence:** Inferred-medium (provider inferred from Claude usage). **Status:** Active / pending reconfirm. **Trigger:** reconfirm the exact export format available in the Anthropic Console before building the parser (Batch B2).

### D6: Value tagging: both, editable
- **Decision:** A deterministic rule map (workflow to tier) is the default and the source of truth. Haiku suggests tiers for unmapped workflows (classification only). User overrides persist in the mapping (within the session, given D2).
- **Why:** Keeps code in charge of the number while using AI only for the judgment it is allowed to make per the architectural laws.
- **Traded off:** Nothing material; this is the honest middle path.
- **Confidence:** User-confirmed. **Status:** Active.

### D7: Branding: Aperio Finance umbrella
- **Decision:** Ship under "Aperio Finance", product name "AI Spend CFO".
- **Why:** Signals a finance-systems body of work rather than a one-off, which is the hiring signal wanted.
- **Confidence:** User-confirmed. **Status:** Active.

### D8: Demo scope: public no-login demo plus ephemeral upload
- **Decision:** Sample data loads for everyone with no login. CSV / provider-export upload is parsed in-browser and never stored.
- **Why:** Proves "it actually works" on real data without auth or persistence, consistent with D1 and D2.
- **Confidence:** User-confirmed. **Status:** Active.

### D9: Real-data depth: the builder's own spend only for v1
- **Decision:** Use the builder's own real spend for v1. A friendly company's anonymized data is a post-launch stretch, not a launch blocker.
- **Why:** Own spend is the launch story and the anti-mockup anchor. Multi-team richness is carried by clearly-labeled synthetic Northstar data.
- **Confidence:** User-confirmed. **Status:** Active. **Trigger:** a willing company and a clean anonymization path post-launch.

---

## 3. Sharp edges surfaced and resolved

### D10: Cost derivation plus reconciliation
- **Decision:** Always re-derive `cost_usd` from the pricing table as the source of truth. When an export also reports a dollar cost, store it and show a reconciliation delta; flag divergence beyond a threshold.
- **Why:** Re-derivation gives one canonical method across providers; reconciliation against provider-reported cost is itself a finance-credibility flex.
- **Traded off:** Slightly more parsing work for a stronger truth claim.
- **Confidence:** User-confirmed (recommendation accepted). **Status:** Active.

### D11: Pricing table versioning
- **Decision:** Seed a small curated table (the models actually used plus common ones), each row carrying `effective_date`. For any event, select the latest price row with `effective_date <= event date`. Show "prices as of …" on the methodology page. Maintained manually by the builder.
- **Why:** Prices change; versioning by effective date keeps historical costs correct and the method honest.
- **Confidence:** User-confirmed. **Status:** Active. **Human gate:** the seeded price values are confirmed by the human before the methodology page presents them as authoritative (DISCOVERY §12).

### D12: Model tiers and repricing
- **Decision:** A static, editable map keyed by provider+model into frontier / mid / cheap, with a recommended cheaper target per tier. Misuse savings = current cost minus the same tokens repriced at the cheaper tier.
- **Why:** A deterministic savings figure with no AI in the number, per the architectural laws.
- **Confidence:** User-confirmed. **Status:** Active.

### D13: Forecast guards
- **Decision:** Calendar-day pacing by default; business-day pacing exposed as a noted one-line-switch assumption. If `days_elapsed < 3`, the forecast is labeled "early / low confidence" rather than reported as an overrun. If a dimension has no budget, show "no budget set", never a false overrun.
- **Why:** Early-month run-rate is noisy; unguarded it produces alarmist or false variance, which would undercut credibility.
- **Confidence:** User-confirmed. **Status:** Active.

### D14: Normalization mapping (actor to team)
- **Decision:** A visible, user-editable mapping table: actor / API-key label to team, workflow, environment, project, and default value_tag. Unmapped actors fall to "Unassigned" and fire the missing-owner flag.
- **Why:** The mapping is the product's normalization value, so it is a visible feature, not hidden config.
- **Confidence:** User-confirmed. **Status:** Active.

### D15: Scale assumption
- **Decision:** Design for up to roughly 50k canonical rows computed in-browser, aggregated on load. No pagination, no server-side compute.
- **Why:** The real month is tiny; synthetic Northstar is a few thousand rows. In-browser compute is comfortable at this scale.
- **Confidence:** User-confirmed. **Status:** Active. **Trigger:** revisit only if a dataset exceeds the assumption.

### D16: Tech stack specifics
- **Decision:** Next.js (App Router) on Vercel; Tremor for the dashboard (built on Recharts), Recharts directly only where Tremor lacks a chart; Papa Parse for CSV; `@react-pdf/renderer` for PDF. Memo model: Opus-class. Value-tag classification model: Haiku.
- **Why:** Next.js gives the single serverless route the live upload memo needs with no extra plumbing. Tremor reaches a polished finance look fastest. Model choices match the value of each call.
- **Traded off:** Lock-in to the Next.js/Vercel pairing, accepted because it removes plumbing for the one server route.
- **Confidence:** Inferred-high (framework and model choices inferred from constraints; reversible). **Status:** Active.
- **Update (2026-06-09):** `@react-pdf/renderer` is dropped. PDF generation now goes through the global `finance-report-pdf` skill on the Typst engine; the app renders PDFs at runtime via `typst.ts` (wasm). See D21 and `FINANCE_PDF_SKILL_DISCOVERY.md`. The rest of the stack (Next.js, Recharts, Papa Parse, Anthropic SDK, model choices) is unchanged.
- **Update (2026-06-09, later):** `@tremor/react` is dropped and replaced by Tailwind CSS plus Recharts-direct, built with the `frontend-design` skill (D23). Playwright is added as the standing behavioral test harness (D24). These supersede the "Tremor" line in this decision.

---

## 4. Decisions surfaced during pack generation

### D17: Internal module layout
- **Decision:** Adopt the file layout proposed in BATCH_PLAN.md (`lib/types.ts`, `lib/pricing`, `lib/metrics/*`, `lib/parsers/*`, `lib/mapping`, `lib/memo/*`, `lib/pdf`, `data/*`, `app/*`, `components/*`). Pure deterministic compute lives under `lib/metrics`; the only server code is `app/api/memo/route.ts`.
- **Why:** Concrete paths let each batch be bounded (methodology requirement). Separating pure compute from UI and from the single server route keeps the architectural laws and the control matrix enforceable in one place.
- **Traded off:** Nothing; this is structure, not behavior, and Batch B0 may adjust exact filenames as it scaffolds, recording any change here.
- **Confidence:** Inferred-high (reversible structure). **Status:** Active.

### D18: Source control and remote (partly resolved in B0)
- **Decision:** The working directory is not yet a git repository. Initializing git, choosing a remote, and the first commit are pending and belong to the human (remote choice) plus Batch B0 (init and first commit of the pack and scaffold).
- **Why:** The methodology requires the pack committed and pushed, but choosing a remote is a human/business decision and pushing was not requested in the pack-generation session.
- **Confidence:** User-confirmed (not a git repo per environment). **Status:** RESOLVED (2026-06-09). Git initialized, genesis commit on `main` (B0), and the user chose a public GitHub repo: remote `origin` added at https://github.com/Wammiri/ai-spend-cfo and `main` pushed. Remaining is one human web step: connect Vercel to the repo so it auto-deploys on push. **Git note (machine-specific, not committed):** pushing over HTTPS through the corporate proxy needed `git config --local http.schannelCheckRevoke false` (same proxy-revocation cause as the npm `--use-system-ca` workaround); set in `.git/config`, not tracked.

---

## 5. Controls (enforcement decisions)

The two credibility-carrying controls are specified as enforceable rows in DISCOVERY §8 and summarized in CLAUDE.md. They are decisions in their own right:

- **C1:** "needs review" is decided by a pure function in the metrics layer, never by AI discretion. Golden test required. Implemented in Batch B4.
- **C2:** the memo route post-validates every dollar figure against supplied inputs; unsupported figures are flagged or stripped. Test required. Implemented in Batch B4.

---

## 6. Deferred non-goals (record the decision even when building nothing)

Per the methodology, every significant area gets a recorded decision and a trigger, even when nothing is built.

| Item | Decision | Trigger that would change it |
|---|---|---|
| Database / persistence (Supabase) | Not in v1 (D2). | A feature genuinely needs data to survive a session (shareable saved memos, multi-session uploads). |
| Auth and multi-tenancy | Not in v1 (D1). | Decision to turn the demo into a real multi-user product. |
| Second and further provider parsers | Not in v1; Anthropic only (D5). | After launch, when a second real export source is available and wanted. |
| Friendly-company anonymized dataset | Not in v1 (D9). | A willing company and a clean anonymization path post-launch. |
| n8n scheduled monthly memo runs | Out of MVP (spec §10). | After the manual memo path is proven and persistence exists. |
| Duplicate / near-identical prompt detection | Out of MVP (spec §6). | Availability of prompt-level data. |
| Business-day pacing as default | Off by default; calendar default with a one-line switch (D13). | A user explicitly prefers business-day pacing. |
| ML forecasting | Not built; deterministic run-rate / trend / scenario only (spec §12). | Never for v1; would only be revisited if forecasts demonstrably mislead at this scale. |

---

## 7. Human gates (DISCOVERY §12)

- Set `ANTHROPIC_API_KEY` on Vercel. Code reads it; the human sets the value (before Batch B4).
- Confirm the seeded pricing data values before the methodology page presents them as authoritative (before Batch B2 ships that page).
- No destructive database gates exist in v1, because there is no database.

---

## 8. Decisions made after pack generation

*(Append here. Each entry: ID, decision, why, traded off, confidence, status, date. Write conversation decisions here before the next session.)*

### D19: Skill-driven build approach (2026-06-09)
- **Decision:** Build through high-quality skills, not a generic build. `frontend-design` owns all UI craft (B1, B6); `claude-api` governs the AI layer (B2 Haiku classification, B4 memo route); `write-a-skill` authors the bespoke memo-PDF skill (B5); `security-review`, `code-review`, `simplify`, `verify`, and `run` are the standing verification and quality layer invoked per batch (`security-review` specifically on B2 upload parsing and B4 server route). The full mapping lives in BATCH_PLAN.md.
- **Why:** The product's entire value is craft and credibility; the default build look would undercut it. These skills raise UI quality, AI correctness, and verification above the generic baseline.
- **Traded off:** A little more process per batch, for a materially higher quality ceiling.
- **Confidence:** User-confirmed. **Status:** Active. No new product dependency (skills are tooling, not packages).

### D20: Visual design language (2026-06-09)
- **Decision:** Institutional finance with modern execution. Serious finance credibility (muted, restrained palette, data-dense, real typography) executed with modern polish. This is the brief `frontend-design` works to across every surface and the memo.
- **Why:** The audience is finance leaders and FP&A hiring managers; the look must read as audit-grade and trustworthy while still showing modern product craft. It has to convince a CFO and a hiring manager at once.
- **Traded off:** Pure-fintech playfulness and editorial experimentation, for credibility-first restraint.
- **Confidence:** User-confirmed. **Status:** Active. Drives the "done" criteria of B1 and B6.

### D21: Memo PDF via the global finance-report-pdf skill, Typst engine (2026-06-09, revised after grill)
- **Decision:** The memo PDF is produced by a standalone, GLOBAL, reusable skill, `finance-report-pdf`, living at `~/.claude/skills/finance-report-pdf/` (not project-local). It targets a JP Morgan / bulge-bracket craft bar, handles executive memos and multi-page analytical reports, and serves every Aperio product, not just this one. Engine: **Typst** (native furniture, programmatic theming, embedded OFL fonts, and a `typst.ts` wasm build). The skill owns the typographic system via a token theme (Aperio house default). AI Spend CFO consumes it: dev-time generates the committed hero memo PDF (`data/precomputed-memo.pdf`); the live "Download PDF" renders the same Typst template at runtime via `typst.ts` (client-side wasm) from the app's computed memo content (canonical schema JSON). `@react-pdf/renderer` is dropped.
- **Why:** There is no general PDF skill, and a generic `@react-pdf` dump reads as developer-made (the exact failure D4 flagged about jsPDF). The grill on 2026-06-09 established that the user wants a reusable, highest-standard finance-document engine for the whole Aperio body of work. The full requirements and design are in `FINANCE_PDF_SKILL_DISCOVERY.md`.
- **Traded off:** A standalone build effort to author the skill (its own side quest, not an AI Spend CFO batch), for a board-grade artifact, a single source of truth shared between dev-time and runtime, and reuse across products.
- **Confidence:** User-confirmed (skill approach, Typst engine, all grill threads). **Status:** Active. Supersedes D4 part 2 and the `@react-pdf/renderer` line in D16.
- **Note:** the skill is authored separately via `write-a-skill`; AI Spend CFO's B5 only integrates it. The skill is a strict typesetter and never computes figures (mirrors the §4 architectural law).

### D22: B0 toolchain choices (2026-06-09)
- **Decision:** Scaffold pinned to exact versions (no carets), lockfile committed:
  - **Framework / runtime:** Next.js `16.2.7` (App Router, Turbopack build) on React `19.2.7` / react-dom `19.2.7`. This is the current Next 16 pairing and the stronger portfolio signal in mid-2026.
  - **Charts:** `@tremor/react@3.18.7` with `recharts@2.15.4`. Tremor declares a React `^18` peer but runs on React 19 (its only interactive dep, `@headlessui/react@2.2.0`, supports React 19). Resolved with a committed `.npmrc` (`legacy-peer-deps=true`) so installs are reproducible locally and on Vercel. Recharts is pinned to the v2 line Tremor depends on (avoids two Recharts majors in the tree); npm prints a Recharts 2.x deprecation notice, which is expected and accepted for now.
  - **Test runner:** Vitest `4.1.8` (lightest fit for the pure-function `lib/metrics` layer; node test environment; co-located `*.test.ts`).
  - **Lint:** ESLint `9.39.4` (held at 9.x rather than the brand-new 10.x to stay within `eslint-config-next`'s tested range) with `eslint-config-next@16.2.7` consumed as **native flat config** (`eslint.config.mjs` imports `eslint-config-next/core-web-vitals` and `/typescript` directly). The `@eslint/eslintrc` FlatCompat bridge was tried first and dropped: it throws a circular-structure error on this version. `@eslint/eslintrc` was removed as a direct dependency.
  - **TypeScript:** `6.0.3` (latest), strict.
- **Why:** Honors the approved-set decision (D16/D19) while resolving the real-world friction that surfaced at install time (Tremor's stale React peer, Recharts major split, ESLint flat-config migration). Exact pins plus a committed lockfile make the toolchain reproducible, which is the whole point of the B0 gate.
- **Traded off:** A committed `legacy-peer-deps` override and a deprecated Recharts 2.x line, accepted to keep Tremor (D16) usable under React 19 without downgrading the stack. Reversible: it is package.json plus `.npmrc`, with no product code built on it yet.
- **Confidence:** Inferred-high (mechanical toolchain choices, reversible). **Status:** Active. **Flag for B1 (RESOLVED 2026-06-09 by D23):** Tremor 3.x is stale (last published 2025-01-13; v4 only in beta) and requires Tailwind CSS to be set up before its components render. The user chose to switch: drop `@tremor/react`, set up Tailwind CSS, use Recharts-direct, build components with `frontend-design`. The legacy-peer-deps override and the Recharts v2 pin exist only because of Tremor and are removed by the switch. Executed in Batch B0.5, before B1.
- **Schema note (D17 refinement):** `CanonicalUsageEvent` gained an optional `reported_cost_usd?: number | null` field beyond the DISCOVERY §7 list, to hold a provider-reported cost purely for the D10 reconciliation delta (`cost_usd` stays the re-derived source of truth). Recorded here per D17 (B0 may refine the layout and must record it).
- **Filename / file-set note (D17 refinement):** BATCH_PLAN listed `.eslintrc.json`; the scaffold uses `eslint.config.mjs` (flat config is mandatory on ESLint 9 + eslint-config-next 16). Standard scaffold files added beyond the literal B0 list, all within the scaffold mandate: `.npmrc`, `.gitignore`, `vitest.config.ts`, `README.md`.
- **Environment note (not committed):** this machine sits behind a TLS-inspecting corporate proxy whose root CA is trusted by Windows but not by Node's bundled CA store, so `npm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` until Node is told to use the OS trust store (`NODE_OPTIONS=--use-system-ca`). This is per-machine, documented in `README.md` and `SESSION_LOG.md`, and deliberately kept out of the repo (Vercel and unproxied machines do not need it).

### D23: Drop @tremor/react, switch to Tailwind CSS plus Recharts-direct (2026-06-09)
- **Decision:** Remove `@tremor/react` from the stack. Build the dashboard, KPI cards, and chart wrappers directly with Tailwind CSS, using the `frontend-design` skill to the institutional-finance-with-modern-execution brief (D20), with Recharts (direct) for the charts. Tailwind is set up and Tremor removed in Batch B0.5, before B1 builds any UI. The `.npmrc` `legacy-peer-deps=true` override and the Recharts v2 pin are both removed as part of the switch (they existed only to keep Tremor working under React 19); Recharts moves to its current v3 line. This supersedes the "Tremor" choice in D16.
- **Why:** The user's call after the B0 flag (D22). `@tremor/react` 3.x is stale (last published 2025-01-13, v4 beta-only, declared React-18 peer) and forced a legacy-peer-deps hack. The product's whole value is craft and a specific institutional-finance look (D20); hand-built Tailwind components owned by `frontend-design` give full control of that look without a stale dependency or a peer-dep override, which is the stronger portfolio signal. Tremor would also have needed Tailwind set up anyway.
- **Traded off:** Tremor's ready-made finance components, for full design control and a clean dependency graph. More component work in B1, absorbed by the `frontend-design` skill. Reversible (no UI built on Tremor yet, so the switch is cheap now; that is why it happens before B1).
- **Confidence:** User-confirmed ("switch and set up tailwind as recommended"). **Status:** Active. Resolves the D22 B1 flag.

### D24: Verification and delivery process (2026-06-09)
- **Decision:** Two standing process rules, now codified in CLAUDE.md and BATCH_PLAN.md (they restate and sharpen the methodology so they are not missed):
  1. **Push after every batch.** A batch is not complete until it is committed AND pushed to the git remote. The remote is created and connected at B0.5 (resolving the rest of D18). Once connected, Vercel auto-deploys on push, so each pushed batch is also deployed. Until B0.5, commits are local only.
  2. **Playwright is the standing behavioral / UI test harness.** Every batch that ships or changes UI gets a Playwright check (rung 3 of the verification ladder); pure-logic batches still prove at the Vitest logic/regression rung (no browser for pure math, per the methodology). Playwright (plus its browser binaries and a smoke e2e) is installed at B0.5.
- **Why:** The user asked for both to be explicit in the project rules after B0 ("commit and push after every batch ... always test with playwright ... that should have been stated"). Pushing every batch is the methodology's own rule; it could not run during B0 because there was no remote (D18). Playwright as the named, installed harness removes the "or equivalent" ambiguity for UI batches.
- **Traded off:** Nothing material; this is process discipline plus one verification dependency (Playwright), justified by the rung-3 requirement and the user's request.
- **Confidence:** User-confirmed. **Status:** Active. Playwright and the remote are stood up in B0.5.

### D25: Tailwind v4 (CSS-first), Recharts v3, Playwright pins; B0.5 execution choices (2026-06-09)
- **Decision:** Execute the D23/D24 switch on the current dependency lines, pinned exact (no carets):
  - **Tailwind CSS `4.3.0`** via **`@tailwindcss/postcss@4.3.0`** (both devDependencies). v4 is CSS-first: there is no `tailwind.config.ts`. PostCSS is wired in `postcss.config.mjs` with the `@tailwindcss/postcss` plugin; `app/globals.css` does `@import "tailwindcss";` and defines design tokens under `@theme` (seeded restrained baseline only; the full D20 palette is built by `frontend-design` in B1). `globals.css` is imported in `app/layout.tsx`.
  - **Recharts `3.8.1`** (was `2.15.4`), its current v3 line, React-19 compatible. Resolves the D22 Recharts-v2 deprecation note.
  - **`@playwright/test@1.60.0`** (devDependency) with the Chromium browser build only (sufficient and faster for the smoke); `playwright.config.ts` defines a single chromium project and a `webServer` that serves the app; `e2e/smoke.spec.ts` asserts the title plus a computed-style check that a custom `@theme` token compiled (proves Tailwind applied, not just present). A `test:e2e` npm script was added.
  - **`.npmrc` removed entirely** (its only setting, `legacy-peer-deps=true`, existed solely for Tremor). Reinstall is clean with no peer override; verified with `npm ci` (440 packages, zero ERESOLVE warnings).
- **Why:** D23 mandates Tailwind + Recharts-direct and D24 mandates Playwright; this records the concrete versions and the one real deviation from the plan's wording. The plan was written in Tailwind-v3 terms ("directives", `tailwind.config.ts`), but the current line is v4, which is the native Next 16 + Turbopack pairing and the stronger portfolio signal (same logic as D22's "current stack"). v4 being CSS-first means no `tailwind.config.ts` is created, which is intentional, not an omission.
- **Traded off:** The plan's `tailwind.config.ts` file (not created; v4 keeps tokens in CSS) and the familiarity of v3's JS config, for the current, faster, idiomatic v4 setup. Fully reversible: package.json plus three config files, no product UI built on it yet.
- **Confidence:** Inferred-high (mechanical, reversible; resolvable from D22/D23 logic without a new user call). **Status:** Active. **Flag for the human:** the v3-to-v4 choice and the dropped `tailwind.config.ts` are a deviation from the literal B0.5 file list, surfaced here and in SESSION_LOG.md per the ambiguity protocol.

### D26: B1 scope, sample-data design, and the audit-grade-ledger design system (2026-06-09)
- **Decision (scope):** B1 ships only what the pure read-only aggregations can substantiate, so the dashboard and the cached hero memo are perfectly consistent and nothing un-built is shown as if real. Concretely:
  - The dashboard shows spend COMPOSITION (total, cost/request, by team/model/tier/value-tag/provider, daily trend, approved-vs-unapproved, prod-vs-experiment) and waste INDICATORS (low-value, unapproved, missing-owner, frontier-tier, frontier-on-low-value spend), all simple sums/groupings in `lib/metrics/aggregate.ts`.
  - Budgets, pace, variance, forecast scenarios (B3, D13) and live model-tier repricing for savings (B4, D12) are deliberately NOT built in B1. The memo therefore frames itself as the first governance review that ESTABLISHES the baseline and recommends setting budgets, which honestly sets up B3.
  - The Northstar sample is a CLOSED month (May 2026, 31 days), so the demo reports actuals with no pacing/forecast guard to apply, sidestepping D13 cleanly until B3.
- **Decision (cached memo):** Per D3, the sample memo is precomputed and committed (`data/precomputed-memo.json`), hand-authored for B1 since the live route (B4) and the API key do not exist yet. Its language is the AI-style narrative; its every dollar figure is the deterministic output of `aggregate.ts`. A reconciliation test (`aggregate.test.ts`) asserts each memo figure equals the computed aggregate. This is a B1 precursor to control C2 (memo number integrity); C2 proper lands in B4 on the live route. The memo also carries an in-code `needs_review` exclusion to demonstrate the C1 honesty stance visibly (credibility gate).
- **Decision (data generation):** `data/northstar.json` is produced by a committed, seeded generator `data/generate-northstar.mjs` (deterministic, no deps, no network). Costs are DERIVED (tokens x embedded illustrative prices) so figures are physically plausible; the authoritative pricing table (D11) is a B2 concern. Every row carries `source: "synthetic"` and the dataset is labeled "Sample data" (honest labeling).
- **Decision (design system, D20 executed):** "Audit-grade ledger": warm paper, deep warm ink, one ledger-green accent (`#0e5a4e`), muted finance semantics (oxblood risk, ochre caution, forest positive), a serif display/document face over a clean sans with tabular numerals, hairline rules, the typeset CFO memo as the hero. Tokens live in `app/globals.css` under Tailwind v4 `@theme`. **Typography choice:** a system serif + sans stack (no web-font fetch). Rationale: avoids build-time/dev-time font fetches that are fragile behind the corporate TLS proxy (D22 network note), adds no dependency (methodology: a dependency is a decision), and still reads as institutional via serif/sans contrast and tabular figures. A distinctive licensed web font (e.g. via the global PDF skill's OFL faces) is a cheap future upgrade once off the proxy / on Vercel.
- **Decision (Playwright harness reliability):** `playwright.config.ts` now runs e2e against a PRODUCTION server (`npm run build && npm run start`, `PW_DEV=1` opts back to dev) with `workers: 1`. Under the dev server, Turbopack compiles each route on first hit; under parallel workers a single local `next start` process also contends. Both blew the test budget in B1. A serial run against a prebuilt server is fast (~17s) and reliable, and mirrors Vercel. This refines the B0.5 harness; it is verification tooling, not product behavior.
- **Files touched beyond the literal B1 bounded list (recorded per D17):** `app/globals.css` (the full D20 palette, explicitly deferred to B1 by the B0.5 globals.css note and the file layout), `lib/metrics/aggregate.test.ts` (the matching Vitest proof for the pure module, the natural rung-2 check), `data/generate-northstar.mjs` (reproducible source for the committed dataset), and `playwright.config.ts` (harness reliability above). Each is justified and within the spirit of B1; none changes another batch's product code.
- **Traded off:** A slightly larger B1 file set and a less dramatic memo headline (no projected-overrun line until B3) in exchange for a memo and dashboard that never cite a number the code did not compute, which is the entire credibility pitch.
- **Confidence:** Inferred-high for the scope and design choices (reversible; resolvable from the plan and D3/D13/D20 without a new user call). **Status:** Active. **Flag for the human:** confirm the audit-grade-ledger look and the closed-month sample framing; both are reversible.
