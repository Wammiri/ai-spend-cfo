# AI Spend CFO

Budget control for AI spend. It turns raw AI usage logs into budget variance, spend forecasts, waste detection and a control memo a CFO can read.

**Live demo:** <https://ai-spend-cfo.vercel.app>

It is a portfolio demo: one public instance, with no accounts and no database. The sample data is a made-up company.

## What it does

1. **Reads usage.** Upload a CSV of AI usage, or start from the sample data.
2. **Normalises cost.** Usage is priced and grouped by department, workflow, model or environment.
3. **Compares to budget.** Pace, variance and projected month-end.
4. **Finds waste and risk.**
5. **Writes the control memo.** Claude turns the computed figures into plain language.

Every number is computed by pure functions in `lib/metrics`. The AI never calculates. It only puts finished numbers into words.

## Stack

- Next.js 16 (App Router), React 19 and TypeScript
- Tailwind CSS 4 and Recharts
- Papa Parse for CSV files
- Anthropic SDK for the memo and for tagging usage by value
- Vitest for the calculations, Playwright for the interface
- Hosted on Vercel

## Run it locally

Needs Node.js 20.9 or later.

```bash
git clone https://github.com/Wammiri/ai-spend-cfo.git
cd ai-spend-cfo
npm ci
cp .env.example .env.local
npm run dev      # http://localhost:3000
```

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Writing a memo for an uploaded file. The sample memo is stored in the repo, so the demo runs without a key |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serves the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests for the calculations (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright). Run `npx playwright install chromium` once first |

## Project structure

```text
app/           pages (landing, dashboard, upload, memo, methodology) and the API
components/    interface pieces and charts
lib/metrics/   every calculation
lib/parsers/   reading usage files
lib/mapping/   matching columns in an uploaded file
lib/pricing/   model prices
lib/memo/      building and checking the memo
data/          the sample company and its stored memo
e2e/           Playwright tests
```

## Status

Built: the demo, CSV upload, budgets and forecasts, waste and risk checks, and the AI memo. Not built yet: PDF reports, and export and sharing. [BATCH_PLAN.md](BATCH_PLAN.md) has the detail.

## Documentation

| File | What is in it |
| --- | --- |
| [DISCOVERY.md](DISCOVERY.md) | What the product is for, and its control matrix |
| [DECISIONS.md](DECISIONS.md) | What was chosen and why |
| [BATCH_PLAN.md](BATCH_PLAN.md) | The work, batch by batch |
| [CHANGELOG.md](CHANGELOG.md) | What changed in the product |

<details>
<summary>Installing behind a corporate proxy that inspects TLS</summary>

On a machine where a proxy replaces certificates, Node may fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Tell Node to trust the operating system's certificates, then install:

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
npm install
```

The same setting lets the Playwright browser download work. If pushing with git fails its certificate revocation check:

```powershell
git config --local http.schannelCheckRevoke false
```

Both are settings for that one machine and are not part of the repo.

</details>

## Author

[Isaac Olorode](https://isaac.aperio.finance), under [Aperio Finance](https://aperio.finance). No open-source licence is granted.
