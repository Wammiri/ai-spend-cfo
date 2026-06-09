import { formatUSD } from "@/lib/metrics/aggregate";
import type { ReconciliationSummary } from "@/lib/metrics/cost";

// Reconciliation display (D10): derived cost vs the cost the provider export
// reported, per model and in total. A clean reconciliation is the credibility
// signal (the derivation matches the provider's own billing); a flagged
// divergence is surfaced, not hidden. Numbers arrive precomputed from
// buildCanonicalEvents; this only renders them.

function pct(deltaPct: number | null): string {
  if (deltaPct === null) return "—";
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${(deltaPct * 100).toFixed(1)}%`;
}

function signedUSD(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${formatUSD(Math.abs(delta))}`;
}

export function ReconciliationPanel({ recon }: { recon: ReconciliationSummary }) {
  const clean = recon.flaggedCount === 0;
  const thresholdLabel = `${(recon.thresholdPct * 100).toFixed(0)}%`;

  return (
    <div className="rounded-lg border border-hairline bg-surface shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">Cost reconciliation</h2>
          <p className="mt-0.5 text-xs text-muted">
            Derived from tokens vs the cost the export reported. Flag threshold {thresholdLabel}.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            clean
              ? "border border-positive/40 bg-positive-wash text-positive"
              : "border border-caution/40 bg-caution-wash text-caution"
          }`}
        >
          {clean ? "Reconciled" : `${recon.flaggedCount} flagged`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-hairline">
        <Cell label="Derived (source of truth)" value={formatUSD(recon.totalDerived)} />
        <Cell label="Provider-reported" value={formatUSD(recon.totalReported)} />
        <Cell
          label="Variance"
          value={`${signedUSD(recon.delta)} (${pct(recon.deltaPct)})`}
          tone={clean ? "muted" : "caution"}
        />
      </div>

      <div className="overflow-x-auto px-1 pb-1">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted">
              <th className="px-4 py-2 font-semibold">Model</th>
              <th className="px-4 py-2 text-right font-semibold">Derived</th>
              <th className="px-4 py-2 text-right font-semibold">Reported</th>
              <th className="px-4 py-2 text-right font-semibold">Variance</th>
              <th className="px-4 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            {recon.byModel.map((m) => (
              <tr key={`${m.provider}-${m.model}`} className="border-t border-hairline">
                <td className="px-4 py-2 font-medium text-ink">{m.model}</td>
                <td className="tnum px-4 py-2 text-right">{formatUSD(m.derived)}</td>
                <td className="tnum px-4 py-2 text-right text-muted">{formatUSD(m.reported)}</td>
                <td className={`tnum px-4 py-2 text-right ${m.flagged ? "text-caution" : "text-muted"}`}>
                  {signedUSD(m.delta)} ({pct(m.deltaPct)})
                </td>
                <td className="px-4 py-2 text-right">
                  {m.flagged ? (
                    <span className="text-caution">Review</span>
                  ) : (
                    <span className="text-positive">Matched</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "muted" | "caution" }) {
  const color = tone === "caution" ? "text-caution" : tone === "muted" ? "text-ink" : "text-ink";
  return (
    <div className="bg-surface px-5 py-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
