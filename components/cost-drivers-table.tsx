import {
  formatPercent,
  formatUSD,
  type CostDriver,
} from "@/lib/metrics/aggregate";

// Ranked cost-driver table for the dashboard. A thin share bar gives the eye a
// quick sense of concentration without a second chart. Server component.

export function CostDriversTable({ drivers }: { drivers: CostDriver[] }) {
  const max = Math.max(...drivers.map((d) => d.value), 1);
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.12em] text-muted">
          <th className="py-2 pr-2 font-medium">#</th>
          <th className="py-2 pr-3 font-medium">Workflow</th>
          <th className="py-2 pr-3 text-right font-medium">Spend</th>
          <th className="hidden py-2 text-right font-medium sm:table-cell">Share</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((d) => (
          <tr key={d.rank} className="border-b border-hairline/60 last:border-0">
            <td className="tnum py-2.5 pr-2 text-faint">{d.rank}</td>
            <td className="py-2.5 pr-3">
              <span className="text-ink">{d.workflow}</span>
              <span className="ml-2 text-xs text-faint">{d.team}</span>
            </td>
            <td className="tnum py-2.5 pr-3 text-right font-medium text-ink">
              {formatUSD(d.value)}
            </td>
            <td className="hidden py-2.5 sm:table-cell">
              <div className="flex items-center justify-end gap-2">
                <span
                  className="hidden h-1.5 rounded-full bg-accent/35 md:block"
                  style={{ width: `${Math.round((d.value / max) * 64)}px` }}
                  aria-hidden
                />
                <span className="tnum w-12 text-right text-muted">
                  {formatPercent(d.share)}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
