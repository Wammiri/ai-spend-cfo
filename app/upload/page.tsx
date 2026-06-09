"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { KpiCard } from "@/components/kpi-card";
import { UploadControl, type LoadedFile } from "@/components/upload-control";
import { MappingEditor } from "@/components/mapping-editor";
import { ReconciliationPanel } from "@/components/reconciliation-panel";
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
} from "@/lib/metrics/aggregate";
import { buildCanonicalEvents } from "@/lib/metrics/cost";
import { DEFAULT_MAPPING, distinctActors, type ActorMapping } from "@/lib/mapping/actor-team";
import { parseCanonicalCsv } from "@/lib/parsers/canonical-csv";
import { looksLikeAnthropicExport, parseAnthropicConsole } from "@/lib/parsers/anthropic-console";
import type { CanonicalUsageEvent, Source } from "@/lib/types";

// Live ingestion surface (B2). A CSV is parsed in-browser (D8, nothing stored),
// normalized to the canonical schema, cost re-derived from the pricing table
// (D10), reconciled against any provider-reported cost, and owners resolved
// through the editable mapping (D14). Every number here is computed by the same
// deterministic metrics layer the static dashboard uses; the page only renders.
//
// Scope (B2): composition + the waste indicators expressible without model
// tiers. Model-tier savings/repricing (D12) and budgets/forecast (D13) are the
// next release, so tier panels are intentionally absent rather than shown wrong.

function MONTHS(): string[] {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

function periodLabel(dates: string[]): string {
  if (dates.length === 0) return "no dates";
  const min = dates[0];
  const max = dates[dates.length - 1];
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    return `${MONTHS()[Number(m) - 1]} ${y}`;
  };
  return min.slice(0, 7) === max.slice(0, 7) ? fmt(min) : `${min} to ${max}`;
}

function buildDataset(events: CanonicalUsageEvent[], source: Source): NorthstarDataset {
  const modelsMap = new Map<string, { provider: string; model: string }>();
  for (const e of events) modelsMap.set(`${e.provider}|${e.model}`, { provider: e.provider, model: e.model });
  // Tier is "mid" placeholder: tier classification + repricing are B4 (D12), so
  // no tier-based panel is rendered here. Composition/waste do not depend on it.
  const models = [...modelsMap.values()].map((m) => ({ ...m, tier: "mid" as const }));
  const dates = events.map((e) => e.date).filter(Boolean).sort();
  return {
    meta: {
      org: source === "synthetic" ? "Sample import" : "Your usage",
      period: dates[0]?.slice(0, 7) ?? "",
      period_label: periodLabel(dates),
      period_status: "actuals",
      currency: "USD",
      source,
      label: source === "synthetic" ? "Sample data" : "Imported data",
      note: "",
      generated_by: "upload",
      row_count: events.length,
    },
    models,
    events,
  };
}

export default function UploadPage() {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ActorMapping>(DEFAULT_MAPPING);

  const parsed = useMemo(() => {
    if (!loaded) return null;
    const isAnthropic = looksLikeAnthropicExport(loaded.text);
    const source: Source = loaded.isSample ? "synthetic" : isAnthropic ? "provider-export" : "real";
    const result = isAnthropic
      ? parseAnthropicConsole(loaded.text, source)
      : parseCanonicalCsv(loaded.text, source);
    return { ...result, source };
  }, [loaded]);

  const ingest = useMemo(
    () => (parsed ? buildCanonicalEvents(parsed.rows, { mapping }) : null),
    [parsed, mapping],
  );

  const agg = useMemo(
    () => (ingest && parsed ? computeAggregates(buildDataset(ingest.events, parsed.source)) : null),
    [ingest, parsed],
  );

  const spendByActor = useMemo(() => {
    const m = new Map<string, number>();
    if (ingest) for (const e of ingest.events) m.set(e.actor, (m.get(e.actor) ?? 0) + e.cost_usd);
    return m;
  }, [ingest]);

  function reset() {
    setLoaded(null);
    setMapping(DEFAULT_MAPPING);
  }

  function load(file: LoadedFile) {
    setMapping(DEFAULT_MAPPING);
    setLoaded(file);
  }

  const errors = parsed?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = parsed?.issues.filter((i) => i.severity === "warning") ?? [];
  const editable = parsed?.format === "anthropic-console";

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Import and normalize</p>
          <h1 className="font-serif text-3xl tracking-tight text-ink">Bring your own AI spend</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Parsed in your browser, never stored. Cost is re-derived from the
            pricing table and reconciled against what the export reported. See the{" "}
            <Link href="/methodology" className="text-accent underline-offset-2 hover:underline">methodology</Link>.
          </p>
        </div>

        <div className="mt-6">
          <UploadControl onLoad={load} onClear={reset} current={loaded?.fileName ?? null} busy={false} />
        </div>

        {parsed && agg ? (
          <div className="mt-8 space-y-6">
            {/* source + period header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-xl tracking-tight text-ink">{agg.org}</h2>
                <span className="text-sm text-muted">{agg.periodLabel}</span>
                <span className="text-xs text-faint">{formatNumber(agg.eventCount)} rows, {agg.activeDays} days</span>
              </div>
              <span
                className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  parsed.source === "synthetic"
                    ? "border border-caution/40 bg-caution-wash text-caution"
                    : "border border-accent/30 bg-accent-wash text-accent"
                }`}
              >
                {parsed.source === "synthetic" ? "Sample" : parsed.source === "real" ? "Your data" : "Provider export"}
              </span>
            </div>

            {/* parse issues */}
            {errors.length > 0 || warnings.length > 0 ? (
              <div className="rounded-md border border-hairline bg-panel px-4 py-3 text-sm">
                {errors.length > 0 ? (
                  <p className="text-risk">{errors.length} row(s) skipped: {errors[0].message}</p>
                ) : null}
                {warnings.length > 0 ? (
                  <p className="text-caution">{warnings.length} warning(s): {warnings[0].message}</p>
                ) : null}
              </div>
            ) : null}

            {/* KPIs (B2-substantiated: no model-tier metrics) */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
              <KpiCard label="Total AI spend" value={formatUSD(agg.totalSpend)} sub={`${formatNumber(agg.totalRequests)} requests`} tone="accent" />
              <KpiCard label="Cost / request" value={`$${agg.costPerRequest.toFixed(4)}`} sub="blended" />
              <KpiCard label="Low-value spend" value={formatUSD(agg.lowValueSpend)} sub={agg.totalSpend ? `${formatPercent(agg.lowValueSpend / agg.totalSpend)} of spend` : undefined} tone="risk" />
              <KpiCard label="Unapproved spend" value={formatUSD(agg.unapprovedSpend)} sub={agg.totalSpend ? `${formatPercent(agg.unapprovedSpend / agg.totalSpend)} of spend` : undefined} tone="risk" />
              <KpiCard label="Missing owner" value={formatUSD(agg.missingOwnerSpend)} sub={agg.totalSpend ? `${formatPercent(agg.missingOwnerSpend / agg.totalSpend)} of spend` : undefined} tone="caution" />
            </div>

            {/* reconciliation (D10): only when the source reported a cost */}
            {ingest?.reconciliation.hasReported ? (
              <ReconciliationPanel recon={ingest.reconciliation} />
            ) : (
              <p className="rounded-md border border-hairline bg-panel px-4 py-3 text-sm text-muted">
                This source reported no cost figure, so there is nothing to reconcile. Cost is derived from tokens and the pricing table.
              </p>
            )}

            {/* mapping (D14): editable for provider exports, file-provided for canonical */}
            {editable ? (
              <MappingEditor
                actors={distinctActors(parsed.rows)}
                spendByActor={spendByActor}
                mapping={mapping}
                onChange={setMapping}
              />
            ) : (
              <p className="rounded-md border border-hairline bg-panel px-4 py-3 text-sm text-muted">
                This canonical file carries its own team, workflow, and value tags, so no owner mapping is needed.
              </p>
            )}

            {/* composition */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Panel title="Daily spend" hint={`${agg.activeDays} days`} className="lg:col-span-2">
                <DailyTrendChart data={agg.dailyTrend} />
              </Panel>
              <Panel title="By value tag" hint="high / medium / low">
                <CompositionDonut data={agg.byValueTag} kind="value" />
              </Panel>
              <Panel title="Spend by team" className="lg:col-span-1">
                <SpendByTeamChart data={agg.byTeam} />
              </Panel>
              <Panel title="Spend by model" className="lg:col-span-2">
                <ModelBreakdownChart data={agg.byModel} />
              </Panel>
            </div>

            {/* honesty notes */}
            {ingest && ingest.unpricedModels.length > 0 ? (
              <p className="text-xs text-caution">
                No pricing row for: {ingest.unpricedModels.join(", ")}. These rows are costed at $0 until a price is added.
              </p>
            ) : null}
            <p className="text-xs leading-5 text-faint">
              Composition and waste indicators only. Model-tier savings, budgets,
              variance, and the live CFO memo are the next release. Tier panels are
              omitted here rather than shown without the tier model.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-hairline bg-surface p-5 shadow-card ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
