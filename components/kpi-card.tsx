import type { ReactNode } from "react";

// A single KPI tile for the dashboard. Tone drives a thin left rule and the
// value color so risk/caution figures read at a glance, in the restrained
// finance palette (no loud colors). Numbers use tabular figures.

type Tone = "default" | "accent" | "positive" | "caution" | "risk";

const TONE_RULE: Record<Tone, string> = {
  default: "bg-hairline-strong",
  accent: "bg-accent",
  positive: "bg-positive",
  caution: "bg-caution",
  risk: "bg-risk",
};

const TONE_VALUE: Record<Tone, string> = {
  default: "text-ink",
  accent: "text-accent",
  positive: "text-positive",
  caution: "text-caution",
  risk: "text-risk",
};

export function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-surface px-5 py-4 shadow-card">
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${TONE_RULE[tone]}`}
        aria-hidden
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted">
        {label}
      </p>
      <p className={`tnum mt-2 text-2xl font-semibold tracking-tight ${TONE_VALUE[tone]}`}>
        {value}
      </p>
      {sub ? <p className="tnum mt-1 text-xs text-faint">{sub}</p> : null}
    </div>
  );
}
