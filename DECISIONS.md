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
- **Update (2026-06-09):** `@react-pdf/renderer` is dropped. PDF generation now goes through the global `finance-report-pdf` skill on the Typst engine; the app renders PDFs at runtime via `typst.ts` (wasm). See D21 and `FINANCE_PDF_SKILL_DISCOVERY.md`. The rest of the stack (Next.js, Tremor, Recharts, Papa Parse, Anthropic SDK, model choices) is unchanged.

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
- **Confidence:** User-confirmed (not a git repo per environment). **Status:** Local part resolved in Batch B0 (2026-06-09): git initialized and the genesis commit (pack plus scaffold) made on `main`. Still pending the human: choose and add a remote, push, and confirm the Vercel project. No push has happened. **Flagged in SESSION_LOG.md.**

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
- **Confidence:** Inferred-high (mechanical toolchain choices, reversible). **Status:** Active. **Flag for B1:** Tremor 3.x is stale (last published 2025-01-13; v4 only in beta) and requires Tailwind CSS to be set up before its components render. Decide before B1 wires the dashboard whether to keep Tremor 3.18.7 (works on React 19 as above) or move to an alternative (the new copy-paste Tremor, or Recharts-direct). **Trigger that fires the switch:** Tremor components break at render time under React 19 during B1. This is the D16 reversibility trigger.
- **Schema note (D17 refinement):** `CanonicalUsageEvent` gained an optional `reported_cost_usd?: number | null` field beyond the DISCOVERY §7 list, to hold a provider-reported cost purely for the D10 reconciliation delta (`cost_usd` stays the re-derived source of truth). Recorded here per D17 (B0 may refine the layout and must record it).
- **Filename / file-set note (D17 refinement):** BATCH_PLAN listed `.eslintrc.json`; the scaffold uses `eslint.config.mjs` (flat config is mandatory on ESLint 9 + eslint-config-next 16). Standard scaffold files added beyond the literal B0 list, all within the scaffold mandate: `.npmrc`, `.gitignore`, `vitest.config.ts`, `README.md`.
- **Environment note (not committed):** this machine sits behind a TLS-inspecting corporate proxy whose root CA is trusted by Windows but not by Node's bundled CA store, so `npm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` until Node is told to use the OS trust store (`NODE_OPTIONS=--use-system-ca`). This is per-machine, documented in `README.md` and `SESSION_LOG.md`, and deliberately kept out of the repo (Vercel and unproxied machines do not need it).
