import { formatUSD } from "@/lib/metrics/aggregate";
import type { Forecast } from "@/lib/metrics/forecast";

// Forward outlook panel (B3). The scenarios are deterministic projections from
// forecast.ts; this only draws them. Honesty matters here: a closed month is
// realized, so the panel says so plainly and frames the scenarios as forward
// planning numbers, never as actuals for the closed period (D13). Server component.

const SCENARIO_TONE: Record<string, string> = {
  base: "text-ink",
  upside: "text-caution",
  control: "text-positive",
};

export function ForecastOutlook({
  forecast,
  periodLabel,
}: {
  forecast: Forecast;
  periodLabel: string;
}) {
  const closed = forecast.confidence === "closed";
  const early = forecast.confidence === "early";

  const intro = closed
    ? `${periodLabel} is closed at ${formatUSD(forecast.actualToDate)}. The scenarios below project the next period at this run-rate and mix, they are planning figures, not ${periodLabel} actuals.`
    : early
      ? `Only ${forecast.daysElapsed} of ${forecast.daysInMonth} days have elapsed, so this projection is early and low confidence (D13).`
      : `Projected from ${forecast.daysElapsed} of ${forecast.daysInMonth} days elapsed at the current run-rate.`;

  return (
    <div>
      <p className="text-xs leading-5 text-muted">{intro}</p>

      <dl className="mt-4 space-y-3">
        {forecast.scenarios.map((s) => (
          <div key={s.key} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className={`tnum text-sm font-medium ${SCENARIO_TONE[s.key] ?? "text-ink"}`}>
              {formatUSD(s.amount)}
            </dd>
          </div>
        ))}
      </dl>

      {forecast.controlSavings > 0.005 ? (
        <div className="mt-4 rounded-md border border-hairline bg-positive-wash/60 px-3 py-2.5">
          <p className="text-xs leading-5 text-ink-soft">
            Moving low-value workflows down 30% projects a{" "}
            <span className="tnum font-semibold text-positive">
              {formatUSD(forecast.controlSavings)}
            </span>{" "}
            monthly reduction against the base run-rate.
          </p>
        </div>
      ) : null}
    </div>
  );
}
