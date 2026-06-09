import { formatPercent, formatUSD, type BudgetReport } from "@/lib/metrics/aggregate";
import type { BudgetStatus, BudgetLine } from "@/lib/metrics/budget";

// Budget-vs-actual table for the dashboard (B3). Every number is computed by the
// metrics layer (budget.ts); this only draws it. Status is decided in code with
// the D13 guards (no-budget and early never read as overruns), so the pill is a
// faithful render of that decision, not a UI heuristic. Server component.

const STATUS_LABEL: Record<BudgetStatus, string> = {
  healthy: "Healthy",
  "at-risk": "At budget",
  overrun: "Overrun",
  "no-budget": "No budget",
  early: "Early",
};

const STATUS_PILL: Record<BudgetStatus, string> = {
  healthy: "bg-positive-wash text-positive",
  "at-risk": "bg-caution-wash text-caution",
  overrun: "bg-risk-wash text-risk",
  "no-budget": "bg-panel text-muted",
  early: "bg-panel text-muted",
};

const BAR_FILL: Record<BudgetStatus, string> = {
  healthy: "bg-positive",
  "at-risk": "bg-caution",
  overrun: "bg-risk",
  "no-budget": "bg-hairline-strong",
  early: "bg-hairline-strong",
};

function StatusPill({ status }: { status: BudgetStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Signed final variance, worded so no minus sign is needed (house style). */
function Variance({ line }: { line: BudgetLine }) {
  if (line.varianceToDate === null) {
    return <span className="text-faint">no budget</span>;
  }
  const over = line.varianceToDate > 0.005;
  const under = line.varianceToDate < -0.005;
  const magnitude = formatUSD(Math.abs(line.varianceToDate));
  if (!over && !under) return <span className="text-muted">on budget</span>;
  return (
    <span className={over ? "text-risk" : "text-positive"}>
      {magnitude} {over ? "over" : "under"}
    </span>
  );
}

/** A track = budget; the fill = actual/budget, capped at 100% with the status color. */
function UsedBar({ line }: { line: BudgetLine }) {
  const pct = line.usedPct;
  if (pct === null) return null;
  const fill = Math.min(pct, 1) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-panel md:w-24">
        <span
          className={`block h-full ${BAR_FILL[line.status]}`}
          style={{ width: `${fill}%` }}
          aria-hidden
        />
      </div>
      <span className="tnum w-11 text-right text-muted">{formatPercent(pct, 0)}</span>
    </div>
  );
}

function Row({ line, total = false }: { line: BudgetLine; total?: boolean }) {
  return (
    <tr
      className={
        total
          ? "border-t border-hairline-strong font-medium"
          : "border-b border-hairline/60 last:border-0"
      }
    >
      <td className="py-2.5 pr-3 text-ink">{line.key}</td>
      <td className="tnum py-2.5 pr-3 text-right text-muted">
        {line.budget === null ? <span className="text-faint">n/a</span> : formatUSD(line.budget)}
      </td>
      <td className="tnum py-2.5 pr-3 text-right text-ink">{formatUSD(line.actual)}</td>
      <td className="tnum hidden py-2.5 pr-3 text-right sm:table-cell">
        <Variance line={line} />
      </td>
      <td className="hidden py-2.5 pr-3 md:table-cell">
        <UsedBar line={line} />
      </td>
      <td className="py-2.5 text-right">
        <StatusPill status={line.status} />
      </td>
    </tr>
  );
}

export function BudgetVsActual({ report }: { report: BudgetReport }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.12em] text-muted">
          <th className="py-2 pr-3 font-medium">Department</th>
          <th className="py-2 pr-3 text-right font-medium">Budget</th>
          <th className="py-2 pr-3 text-right font-medium">Actual</th>
          <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Variance</th>
          <th className="hidden py-2 pr-3 font-medium md:table-cell">% used</th>
          <th className="py-2 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {report.lines.map((line) => (
          <Row key={line.key} line={line} />
        ))}
        <Row line={report.total} total />
      </tbody>
    </table>
  );
}
