import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SampleBanner } from "@/components/sample-banner";
import { KpiCard } from "@/components/kpi-card";
import { CostDriversTable } from "@/components/cost-drivers-table";
import {
  CompositionDonut,
  DailyTrendChart,
  ModelBreakdownChart,
  SpendByTeamChart,
} from "@/components/charts";
import {
  computeAggregates,
  formatNumber,
  formatPercent,
  formatUSD,
  type NorthstarDataset,
  type SpendSlice,
} from "@/lib/metrics/aggregate";
import northstar from "@/data/northstar.json";

// AI Spend Control Dashboard (B1, spec Module 2). Server component: imports the
// labeled-synthetic Northstar dataset, computes every figure once in the pure
// metrics layer, and hands the results to presentational cards and Recharts
// wrappers. No budget/forecast/repricing here (B3/B4); composition + waste only.

const agg = computeAggregates(northstar as unknown as NorthstarDataset);

function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-hairline bg-surface p-5 shadow-card ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProportionBar({ slices }: { slices: SpendSlice[] }) {
  const colors = ["bg-accent", "bg-risk", "bg-caution", "bg-chart-2"];
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel">
        {slices.map((s, i) => (
          <span
            key={s.key}
            className={colors[i % colors.length]}
            style={{ width: `${s.share * 100}%` }}
            aria-hidden
          />
        ))}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 capitalize text-ink-soft">
              <span className={`h-2.5 w-2.5 rounded-[2px] ${colors[i % colors.length]}`} aria-hidden />
              {s.key}
            </span>
            <span className="tnum text-muted">
              {formatUSD(s.value)}
              <span className="ml-2 text-faint">{formatPercent(s.share)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {agg.org} · {agg.periodLabel}
          </p>
          <h1 className="font-serif text-3xl tracking-tight text-ink">
            AI Spend Control Dashboard
          </h1>
        </div>

        <div className="mt-5">
          <SampleBanner org={agg.org} />
        </div>

        {/* KPI row */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total AI spend"
            value={formatUSD(agg.totalSpend)}
            sub={`${formatNumber(agg.totalRequests)} requests`}
            tone="accent"
          />
          <KpiCard
            label="Cost / request"
            value={`$${agg.costPerRequest.toFixed(4)}`}
            sub="blended, all models"
          />
          <KpiCard
            label="Frontier-tier spend"
            value={formatUSD(agg.frontierSpend)}
            sub={`${formatPercent(agg.frontierSpend / agg.totalSpend)} of spend`}
            tone="caution"
          />
          <KpiCard
            label="Low-value spend"
            value={formatUSD(agg.lowValueSpend)}
            sub={`${formatPercent(agg.lowValueSpend / agg.totalSpend)} of spend`}
            tone="risk"
          />
          <KpiCard
            label="Unapproved spend"
            value={formatUSD(agg.unapprovedSpend)}
            sub={`${formatPercent(agg.unapprovedSpend / agg.totalSpend)} of spend`}
            tone="risk"
          />
          <KpiCard
            label="Missing owner"
            value={formatUSD(agg.missingOwnerSpend)}
            sub={`${formatPercent(agg.missingOwnerSpend / agg.totalSpend)} of spend`}
            tone="caution"
          />
        </div>

        {/* charts */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel title="Daily spend" hint={`${agg.activeDays} days`} className="lg:col-span-2">
            <DailyTrendChart data={agg.dailyTrend} />
          </Panel>
          <Panel title="Spend by department">
            <SpendByTeamChart data={agg.byTeam} />
          </Panel>

          <Panel title="By model tier" hint="frontier / mid / cheap">
            <CompositionDonut data={agg.byTier} kind="tier" />
          </Panel>
          <Panel title="By value tag" hint="high / medium / low">
            <CompositionDonut data={agg.byValueTag} kind="value" />
          </Panel>
          <Panel title="Governance">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted">
                  Approved vs unapproved
                </p>
                <ProportionBar slices={agg.byApproval} />
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted">
                  Production vs experiment
                </p>
                <ProportionBar slices={agg.byEnvironment} />
              </div>
            </div>
          </Panel>

          <Panel title="Top cost drivers" hint="by workflow" className="lg:col-span-2">
            <CostDriversTable drivers={agg.topDrivers} />
          </Panel>
          <Panel title="Spend by model">
            <ModelBreakdownChart data={agg.byModel} />
          </Panel>
        </div>

        <p className="mt-6 text-xs leading-5 text-faint">
          Every figure is computed by the deterministic metrics layer from the
          canonical usage events. See the{" "}
          <Link href="/methodology" className="text-accent underline-offset-2 hover:underline">methodology</Link>{" "}
          for how cost is derived, or{" "}
          <Link href="/upload" className="text-accent underline-offset-2 hover:underline">import</Link>{" "}
          your own export. Budgets, forecasts, and the live memo arrive next.
        </p>
      </main>
    </div>
  );
}
