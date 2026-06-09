// Control C1 (DISCOVERY section 8, CLAUDE.md): "needs review" is decided in
// CODE, not by AI discretion. Before the memo prompt is assembled, this pure
// function partitions cost drivers into those with enough supporting data to be
// eligible for a recommendation and those that do not (a minimum event count, a
// dollar floor, and a non-null owning dimension). Everything that fails the gate
// is handed to the model explicitly tagged "needs review, exclude", so the model
// can never invent or recommend action on a cause the data does not support.
//
// The architectural law this enforces: the AI flags gaps rather than inventing
// causes (DISCOVERY section 4, law 2). The golden test (eligibility.test.ts)
// proves a thin-data driver never reaches the recommendations set.

/** A driver fails the data floor below this many supporting events. */
export const MIN_EVENTS = 3;
/** A driver fails the data floor below this many dollars of spend. */
export const DOLLAR_FLOOR = 50;

/** Tunable gate (one-line switch). Defaults to the two floors above. */
export interface EligibilityConfig {
  minEvents: number;
  dollarFloor: number;
}

export const DEFAULT_ELIGIBILITY: EligibilityConfig = {
  minEvents: MIN_EVENTS,
  dollarFloor: DOLLAR_FLOOR,
};

/** One candidate cost driver and the facts the gate decides on. */
export interface DriverDatum {
  team: string;
  workflow: string;
  /** Dollars of spend attributed to this team + workflow. */
  value: number;
  /** Number of canonical rows behind it (the data-sufficiency signal). */
  events: number;
  /** True when the driver has an attributable owner (team known, project set). */
  hasOwner: boolean;
}

/** A driver that cleared the gate and may be cited in recommendations. */
export interface EligibleDriver extends DriverDatum {
  label: string;
}

/** A driver excluded from recommendations, with the code-decided reason. */
export interface NeedsReviewItem {
  label: string;
  reason: string;
}

export interface DriverPartition {
  /** Cleared the gate, sorted by spend descending. Safe for recommendations. */
  eligible: EligibleDriver[];
  /** Failed the gate. Passed to the model tagged "exclude", never recommended. */
  needsReview: NeedsReviewItem[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Partition candidate drivers into eligible vs needs-review by data sufficiency
 * (C1). The decision is made here, in code, before any prompt is built. A driver
 * is eligible only when it has an attributable owner AND at least `minEvents`
 * events AND at least `dollarFloor` of spend. Anything else is recorded with the
 * specific reason and excluded from the recommendations the model may write.
 */
export function partitionDrivers(
  drivers: DriverDatum[],
  config: EligibilityConfig = DEFAULT_ELIGIBILITY,
): DriverPartition {
  const eligible: EligibleDriver[] = [];
  const needsReview: NeedsReviewItem[] = [];

  for (const d of drivers) {
    const label = `${d.team} / ${d.workflow}`;
    const reasons: string[] = [];
    if (!d.hasOwner) reasons.push("no attributable owner");
    if (d.events < config.minEvents) reasons.push(`only ${d.events} supporting event(s)`);
    if (d.value < config.dollarFloor) {
      // No "$" token here: the floor is a gate, not a memo figure, so it must not
      // trip the C2 number-integrity scan when the reason is rendered.
      reasons.push(`below the ${config.dollarFloor}-dollar attribution floor`);
    }

    if (reasons.length === 0) {
      eligible.push({ ...d, value: round2(d.value), label });
    } else {
      needsReview.push({
        label,
        reason: `Excluded from recommendations: ${reasons.join(", ")}. Recorded but not attributed pending more data.`,
      });
    }
  }

  eligible.sort((a, b) => b.value - a.value);
  return { eligible, needsReview };
}
