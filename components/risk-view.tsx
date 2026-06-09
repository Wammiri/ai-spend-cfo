import { formatUSD } from "@/lib/metrics/aggregate";
import type { RiskFlag } from "@/lib/metrics/risk";

// Quantified waste / risk view (B4, D12). Every flag carries a dollar impact and
// a code-suggested control, both computed deterministically in lib/metrics/risk.
// This only renders them. The frontier-misuse flag is the model-tier repricing
// savings the upload page (B2) deferred to this batch.

export function RiskView({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <section className="rounded-lg border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Waste and risk</h2>
        <p className="mt-0.5 text-xs text-muted">
          Each flag is quantified in dollars from the data and carries a suggested
          control. Flags overlap, so they are exposure measures, not a sum.
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {flags.map((f) => (
          <li key={f.key} className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">{f.label}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted">{f.detail}</p>
              <p className="mt-1 text-xs text-accent">{f.recommendation}</p>
            </div>
            <span className="tnum shrink-0 text-sm font-semibold text-risk">{formatUSD(f.impact_usd)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
