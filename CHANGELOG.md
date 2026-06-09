# Changelog: AI Spend CFO

All notable changes to this product are recorded here. Format follows Keep a Changelog; entries are grouped by batch. House rule observed: no em dashes.

## [Unreleased]

### Added
- Building pack generated from DISCOVERY.md (batch B-pack, 2026-06-09): `CLAUDE.md` (project operating rules), `DECISIONS.md` (D1 to D18 plus controls and deferred non-goals), `BATCH_PLAN.md` (batches B0 to B5 with bounded file lists and the session prompt template), `SESSION_LOG.md`, and this `CHANGELOG.md`.
- Project scaffold and toolchain (batch B0, 2026-06-09): Next.js 16 (App Router) on React 19 with the approved dependency set pinned and lockfile committed; TypeScript (strict), ESLint flat config (`eslint-config-next` 16 native), and Vitest test runner all proven green on the untouched tree. Added the canonical usage and pricing schema (`lib/types.ts`), the deterministic compute barrel (`lib/metrics/index.ts`), a seed test, a placeholder landing page, and project config (`.npmrc`, `.gitignore`, `.env.example`, `README.md`). Git initialized with a genesis commit (not yet pushed). Toolchain decisions recorded as D22.

### Changed
- Plan amended (2026-06-09) for a skill-driven build: added D19 (skills mapped to batches), D20 (institutional-finance-with-modern-execution design language), and D21 (memo PDF produced by a bespoke authored `cfo-memo-pdf` skill). BATCH_PLAN.md gained a skills mapping, per-batch skill annotations, and a new batch B5 (author the PDF skill); the old export batch became B6.

### Notes
- No product code yet. The toolchain (Next.js scaffold, dependencies, test runner) is stood up in Batch B0, which is the first code batch and a separate session from pack generation.
- Skills are tooling, not product dependencies; this amendment added no packages.
- Grilled and specified a standalone global `finance-report-pdf` skill (JP Morgan craft bar, Typst engine) in `FINANCE_PDF_SKILL_DISCOVERY.md`. Consequence for this product: `@react-pdf/renderer` is dropped (D21 revised, D16 updated); the app will render PDFs at runtime via `typst.ts` (wasm). BATCH_PLAN B5 changed from authoring the skill to integrating the global one; the skill is authored separately.
