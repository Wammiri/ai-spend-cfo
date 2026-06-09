# AI Spend CFO

The FP&A layer for AI spend. It turns raw AI usage logs into budget variance,
spend forecasts, waste detection, and a CFO-ready control memo. Shipped under the
Aperio Finance umbrella.

Positioning: AI cost governance for finance, not AI analytics for engineering.
The hero is the CFO memo, not the charts.

This is a portfolio / credibility artifact: a single-tenant public demo with no
auth, no multi-tenancy, and no database in v1. See `DISCOVERY.md` and
`DECISIONS.md` for the full rationale.

## Tech stack

- Next.js (App Router) on Vercel, TypeScript throughout.
- Tremor (on Recharts) for the dashboard; Recharts directly where Tremor lacks a chart.
- Papa Parse for CSV ingestion.
- Anthropic SDK for the memo and the value-tag classification calls.
- Vitest for the deterministic compute tests.
- PDFs are produced via the global `finance-report-pdf` skill (Typst), integrated at Batch B5.

All numbers are computed by pure functions in `lib/metrics`. The AI never
calculates; it turns already-computed numbers into language (see `CLAUDE.md`).

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build (proves the toolchain)
npm run lint       # eslint (flat config, eslint-config-next)
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
```

## Local setup behind a TLS-inspecting corporate proxy

If your machine sits behind a corporate proxy that performs TLS inspection, the
proxy's root CA is trusted by Windows but not by Node's bundled CA store, so
`npm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Make Node trust the
OS certificate store for the install:

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
npm install
```

This is a per-machine network workaround and is deliberately not committed to the
repo (Vercel and unproxied machines do not need it). The repo-level `.npmrc` only
sets `legacy-peer-deps=true`, which Tremor 3.x requires under React 19.

Pushing over HTTPS through the same proxy also fails its certificate revocation
check. This repo's local git config disables that check:

```powershell
git config --local http.schannelCheckRevoke false
```

That setting lives in `.git/config` (not tracked) and is also per-machine.

## The building pack

State lives in files, not chat. Read order each session: `DECISIONS.md`, then
`SESSION_LOG.md`, then `BATCH_PLAN.md`. `DISCOVERY.md` holds product intent and
the control matrix; `CLAUDE.md` is the project's operating rules.
