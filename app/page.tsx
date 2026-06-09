import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { formatUSD, stripEmDashes as strip } from "@/lib/metrics/aggregate";
import { type MemoDocument } from "@/components/memo-view";
import memoData from "@/data/precomputed-memo.json";

const memo = memoData as unknown as MemoDocument;

// The exec-summary opener, the snippet shown in the hero memo preview.
const introBlock = memo.sections[0]?.blocks.find((b) => b.type === "paragraph");
const introText = introBlock && "text" in introBlock ? introBlock.text : "";

// Landing (B1): the 10-second pitch. Leads with the CFO memo, which is the hero
// (DISCOVERY section 1), and states the governance-not-monitoring positioning
// (D7/D20). Built on the audit-grade-ledger design system. Server component.

const PIPELINE = [
  "Usage logs",
  "Normalized cost",
  "Budget variance",
  "Forecast",
  "Waste & risk",
  "Control memo",
];

const PILLARS = [
  {
    title: "Budget variance",
    body: "Set budgets by department, workflow, model, or environment. See pace, variance, and projected month-end, computed in code, never guessed by a model.",
  },
  {
    title: "Waste detection, in dollars",
    body: "Expensive-model misuse, low-value spend, unapproved usage, and ownerless cost, each quantified. The shareable number is a dollar figure, not a vibe.",
  },
  {
    title: "A board-ready memo",
    body: "The whole workflow ends in a CFO memo a finance leader would actually forward: drivers, risks, and recommended controls, each tied to an impact.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* hero */}
      <section className="bg-ledger border-b border-hairline">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-24">
          <div className="animate-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              The FP&amp;A layer for AI spend
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Govern AI spend the way finance governs everything else.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
              AI Spend CFO turns raw usage logs into budget variance, spend
              forecasts, waste detection, and a board-ready control memo. It is
              governance for finance, not another observability dashboard for
              engineering.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/memo"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-accent-soft"
              >
                Read the CFO memo
                <span aria-hidden>&rarr;</span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-hairline-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-panel"
              >
                Explore the dashboard
              </Link>
            </div>

            <p className="mt-8 max-w-xl border-l-2 border-accent/40 pl-4 text-sm italic leading-6 text-muted">
              FinOps tools tell engineers what they spent. Nobody gives finance a
              way to govern it, with budgets, variance, ownership, and controls.
              That is this.
            </p>
          </div>

          {/* memo preview: the hero artifact */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <Link href="/memo" className="group block">
              <div className="relative overflow-hidden rounded-md border border-hairline bg-surface shadow-lift transition-transform duration-300 group-hover:-translate-y-1">
                <div className="h-1 w-full bg-accent" aria-hidden />
                <div className="px-6 py-6 sm:px-8 sm:py-8">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                      Aperio Finance · AI Spend CFO
                    </p>
                    <span className="rounded-sm border border-caution/40 bg-caution-wash px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-caution">
                      Sample
                    </span>
                  </div>
                  <h2 className="mt-3 font-serif text-2xl tracking-tight text-ink">
                    {strip(memo.meta.title)}
                    <span className="text-faint"> · {memo.meta.period_label}</span>
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-hairline bg-hairline">
                    {memo.headline.slice(0, 2).map((h) => (
                      <div key={h.label} className="bg-surface px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
                          {strip(h.label)}
                        </p>
                        <p className="tnum mt-0.5 text-lg font-semibold text-ink">
                          {formatUSD(h.value_usd)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink-soft">
                    {strip(introText)}
                  </p>
                  <p className="mt-3 border-t border-hairline pt-3 text-xs italic leading-5 text-muted">
                    {strip(memo.needs_review_note)}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    Read the full memo
                    <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                      &rarr;
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* the workflow */}
      <section className="border-b border-hairline bg-panel">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            The governance workflow
          </p>
          <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-3">
            {PIPELINE.map((step, i) => {
              const last = i === PIPELINE.length - 1;
              return (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={`text-sm ${last ? "font-semibold text-accent" : "text-ink-soft"}`}
                  >
                    {step}
                  </span>
                  {!last ? (
                    <span className="text-faint" aria-hidden>
                      &rarr;
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* pillars */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-surface px-6 py-7">
              <h3 className="font-serif text-lg tracking-tight text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-hairline bg-accent-wash/50 px-6 py-6">
          <p className="text-sm leading-7 text-ink-soft">
            <span className="font-medium text-ink">Built on a hard rule:</span>{" "}
            deterministic code computes every number, the AI never calculates. It
            explains, classifies, and recommends from figures the metrics layer
            produced. Where the data does not support a cause, the memo says
            &ldquo;needs review&rdquo; instead of inventing one.
          </p>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-xs text-faint lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>
            <span className="font-semibold uppercase tracking-[0.16em] text-accent">
              Aperio Finance
            </span>{" "}
            · AI Spend CFO
          </p>
          <p>
            Demo on synthetic Northstar AI Labs data, labeled sample throughout.
            Real own-spend ingestion arrives next.
          </p>
        </div>
      </footer>
    </div>
  );
}
