"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCompact,
  formatPercent,
  formatUSD,
  type DailyPoint,
  type ModelSpend,
  type SpendSlice,
} from "@/lib/metrics/aggregate";

// Recharts-direct chart wrappers (D23). All numbers arrive precomputed from the
// metrics layer; charts only draw them. Colors reference @theme tokens so the
// restrained finance palette stays in one place. SVG fill accepts var(--token).

const SERIES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];

// tier ramp encodes cost: frontier reads as the expensive/attention tier
const TIER_COLOR: Record<string, string> = {
  frontier: "var(--color-risk)",
  mid: "var(--color-caution)",
  cheap: "var(--color-positive)",
};

const VALUE_COLOR: Record<string, string> = {
  high: "var(--color-accent)",
  medium: "var(--color-chart-2)",
  low: "var(--color-risk)",
};

const AXIS_TICK = { fill: "var(--color-muted)", fontSize: 11 };
const moneyAxis = (v: number) => `$${formatCompact(v)}`;

type TipRow = { name: string; value: number; share?: number };

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: TipRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-ink">{row.name ?? label}</p>
      <p className="tnum mt-0.5 text-muted">
        {formatUSD(row.value)}
        {typeof row.share === "number" ? ` · ${formatPercent(row.share)}` : ""}
      </p>
    </div>
  );
}

export function SpendByTeamChart({ data }: { data: SpendSlice[] }) {
  const rows: TipRow[] = data.map((d) => ({ name: d.key, value: d.value, share: d.share }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <XAxis type="number" tickFormatter={moneyAxis} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "var(--color-panel)" }} content={<MoneyTooltip />} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={18}>
          {rows.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModelBreakdownChart({ data }: { data: ModelSpend[] }) {
  const rows = data.map((d) => ({ name: d.model, value: d.value, share: d.share, tier: d.tier }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <XAxis type="number" tickFormatter={moneyAxis} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "var(--color-panel)" }} content={<MoneyTooltip />} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
          {rows.map((r, i) => (
            <Cell key={i} fill={TIER_COLOR[r.tier] ?? SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyTrendChart({ data }: { data: DailyPoint[] }) {
  const rows = data.map((d) => ({ name: d.date, day: d.date.slice(8), value: d.value }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={3} />
        <YAxis tickFormatter={moneyAxis} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
        <Tooltip cursor={{ stroke: "var(--color-hairline-strong)" }} content={<MoneyTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={false}
          activeDot={{ r: 3, fill: "var(--color-accent)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CompositionDonut({
  data,
  kind,
}: {
  data: SpendSlice[];
  kind: "tier" | "value";
}) {
  const palette = kind === "tier" ? TIER_COLOR : VALUE_COLOR;
  const rows: TipRow[] = data.map((d) => ({ name: d.key, value: d.value, share: d.share }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="h-[160px] w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={76}
              paddingAngle={1.5}
              stroke="var(--color-surface)"
              strokeWidth={2}
            >
              {rows.map((r, i) => (
                <Cell key={i} fill={palette[r.name] ?? SERIES[i % SERIES.length]} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 capitalize text-ink-soft">
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: palette[r.name] }}
                aria-hidden
              />
              {r.name}
            </span>
            <span className="tnum text-muted">
              {formatUSD(r.value)}
              <span className="ml-2 text-faint">{formatPercent(r.share ?? 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
