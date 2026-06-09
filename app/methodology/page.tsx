import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import {
  PRICES_AS_OF,
  PRICING_CONFIRMED,
  PRICING_TABLE,
} from "@/lib/pricing/pricing-table";
import { RECONCILE_THRESHOLD_PCT } from "@/lib/metrics/cost";

// "How cost is calculated" methodology page (B2, DISCOVERY section 9 credibility
// gate). It states the honesty stance openly (the architectural laws are the
// differentiator, DISCOVERY section 4), shows the deterministic cost formula and
// the reconciliation method (D10), and presents the versioned pricing table
// (D11). Server component: it reads the pricing module directly, the same source
// of truth every cost in the product derives from.

export const metadata = {
  title: "Methodology, AI Spend CFO",
  description: "How cost is calculated: the pricing table, the derivation formula, reconciliation, and the honesty stance.",
};

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-6 shadow-card lg:p-7">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 font-serif text-xl tracking-tight text-ink">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-ink-soft">{children}</div>
    </section>
  );
}

const thresholdPct = `${(RECONCILE_THRESHOLD_PCT * 100).toFixed(0)}%`;

// Rows newest-effective-first within each model, so the versioning is visible.
const pricingRows = [...PRICING_TABLE].sort((a, b) =>
  a.provider !== b.provider
    ? a.provider.localeCompare(b.provider)
    : a.model !== b.model
      ? a.model.localeCompare(b.model)
      : b.effective_date.localeCompare(a.effective_date),
);

export default function MethodologyPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Methodology</p>
          <h1 className="font-serif text-3xl tracking-tight text-ink">How cost is calculated</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            The whole product rests on one claim: every number is computed by
            code from the data, and nothing is invented. This page shows exactly
            how, so a finance reader can audit the method rather than trust it.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <Section eyebrow="The stance" title="Deterministic by law, honest by design">
            <p>
              Two rules govern this product and are not negotiable. First,
              deterministic code computes every number. Totals, variances,
              forecasts, and savings are produced by pure functions from the
              usage data; the AI receives already-computed figures and turns
              them into language, never the reverse. Second, the AI flags gaps
              rather than inventing causes. Where the data does not support a
              cause, it is marked &quot;needs review&quot; and excluded from
              recommendations.
            </p>
            <p>
              These are enforced, not promised. A pure function decides what has
              enough supporting data to be acted on (control C1), and the memo
              route post-validates every dollar figure it returns against the
              numbers it was given (control C2). Those controls and the live
              memo land in a later release; the deterministic core they protect
              is what computes the dashboard you can see today.
            </p>
          </Section>

          <Section eyebrow="One shape" title="The canonical usage schema">
            <p>
              Every provider exports a different format, and exports usually give
              tokens, not dollars. The product&apos;s job is normalization: every
              source is mapped into one canonical usage event, and cost is
              derived from tokens. A canonical event carries its date, actor,
              team, workflow, provider, model, input and output (and cached)
              tokens, request count, value tier, approval status, environment,
              project, and a <span className="font-medium text-ink">source</span>{" "}
              label (real, provider-export, or synthetic) so data provenance is
              always honest on screen.
            </p>
          </Section>

          <Section eyebrow="The formula" title="Cost derivation">
            <p>
              Cost is re-derived for every row from the pricing table, even when
              an export already reports a dollar figure. Prices are quoted per
              one million tokens:
            </p>
            <pre className="tnum overflow-x-auto rounded-md border border-hairline bg-panel px-4 py-3 text-[13px] leading-6 text-ink">
{`cost_usd = input_tokens        / 1e6 x input_price_per_1m
         + output_tokens       / 1e6 x output_price_per_1m
         + cached_input_tokens / 1e6 x cached_input_price_per_1m`}
            </pre>
            <p>
              Cached input is priced at the cached rate when a provider offers
              one, otherwise it falls back to the standard input rate so those
              tokens are never silently dropped.
            </p>
          </Section>

          <Section eyebrow="The check" title="Reconciliation against provider-reported cost">
            <p>
              When an export reports its own dollar cost, that figure is stored
              but never trusted as the source of truth. Instead the derived cost
              is compared against it and the delta is shown. A divergence beyond{" "}
              {thresholdPct} is flagged for review, per model and in total. A
              clean reconciliation is itself the credibility signal: it shows the
              derivation matches the provider&apos;s own billing.
            </p>
          </Section>

          <Section eyebrow="The prices" title="Pricing table, versioned by effective date">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">Prices as of {PRICES_AS_OF}.</span>
              {PRICING_CONFIRMED ? (
                <span className="inline-flex items-center rounded-sm border border-positive/40 bg-positive-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-positive">
                  Confirmed
                </span>
              ) : (
                <span className="inline-flex items-center rounded-sm border border-caution/40 bg-caution-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-caution">
                  Illustrative, pending confirmation
                </span>
              )}
            </div>
            <p>
              Each row carries an effective date. For any usage event, the
              latest price whose effective date is on or before the event date is
              used, so historical spend stays correctly priced when a vendor
              changes a price mid-stream. The table below shows a prior
              Opus row to make that versioning visible.
            </p>

            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-panel text-left text-[11px] uppercase tracking-[0.1em] text-muted">
                    <th className="px-3 py-2 font-semibold">Provider</th>
                    <th className="px-3 py-2 font-semibold">Model</th>
                    <th className="px-3 py-2 text-right font-semibold">Input / 1M</th>
                    <th className="px-3 py-2 text-right font-semibold">Output / 1M</th>
                    <th className="px-3 py-2 text-right font-semibold">Cached / 1M</th>
                    <th className="px-3 py-2 text-right font-semibold">Effective</th>
                  </tr>
                </thead>
                <tbody className="text-ink-soft">
                  {pricingRows.map((r, i) => (
                    <tr key={`${r.provider}-${r.model}-${r.effective_date}`} className={i % 2 ? "bg-surface" : "bg-paper/40"}>
                      <td className="px-3 py-2 capitalize">{r.provider}</td>
                      <td className="px-3 py-2 font-medium text-ink">{r.model}</td>
                      <td className="tnum px-3 py-2 text-right">${r.input_price_per_1m.toFixed(2)}</td>
                      <td className="tnum px-3 py-2 text-right">${r.output_price_per_1m.toFixed(2)}</td>
                      <td className="tnum px-3 py-2 text-right text-muted">
                        {r.cached_input_price_per_1m !== undefined ? `$${r.cached_input_price_per_1m.toFixed(2)}` : "—"}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-muted">{r.effective_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-faint">
              Values are illustrative public list prices maintained by hand and
              are not yet independently confirmed. They are the seed for the
              derivation, not a vendor quote.
            </p>
          </Section>

          <Section eyebrow="The imports" title="What parses, and how owners are assigned">
            <p>
              Two formats are supported today: the canonical CSV (the schema
              above, downloadable as a starting point) and the Anthropic Console
              usage export, the first real provider parser. The exact Anthropic
              export columns are being reconfirmed against the current console;
              the parser accepts the common column names and is a one-line change
              if the format shifts.
            </p>
            <p>
              A provider export knows an API key, not who owns it. A visible,
              editable mapping turns each actor into a team, workflow,
              environment, project, and default value tier. An actor that matches
              no rule falls to &quot;Unassigned&quot; with no project, which is exactly the
              ownership gap finance needs surfaced, so it fires the missing-owner
              flag rather than being hidden.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/upload"
                className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
              >
                Try it with your data
              </Link>
              <a
                href="/sample-canonical.csv"
                download
                className="inline-flex items-center rounded-md border border-hairline-strong bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel"
              >
                Download sample CSV
              </a>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
