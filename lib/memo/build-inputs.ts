// Assemble the computed inputs the memo prompt is allowed to see (B4). This is
// the boundary the architectural laws turn on (DISCOVERY section 4, CLAUDE.md):
// every number here is produced by the deterministic metrics layer, and the memo
// route injects ONLY these numbers into the prompt. The model receives no raw
// data and computes nothing; it turns these figures into language.
//
// Three things live here:
//   - buildMemoInputs: turn a normalized dataset into the compact MemoInputs the
//     client POSTs to /api/memo (drivers partitioned by C1, risk flags by D12,
//     the B3 budget report and forecast folded in, D26).
//   - collectMemoFigures: the flat set of every supplied dollar figure, derived
//     server-side from the received MemoInputs, used by control C2 to validate
//     that the model output cites no figure it was not given.
//   - assembleMemo: compose the model's language (MemoNarrative) with the
//     code-computed numbers into the MemoDocument the UI renders. Every dollar in
//     the rendered memo is app-injected from a supplied figure or model prose
//     that C2 then validates.

import type { CanonicalUsageEvent, Source } from "../types";
import type { MemoDocument } from "@/components/memo-view";
import {
  buildBudgetReport,
  buildOutlook,
  computeAggregates,
  formatPercent,
  formatUSD,
  type BudgetReport,
  type NorthstarDataset,
} from "../metrics/aggregate";
import { periodContext, type Forecast } from "../metrics/forecast";
import type { BudgetStatus } from "../metrics/budget";
import {
  partitionDrivers,
  type DriverDatum,
  type NeedsReviewItem,
} from "../metrics/eligibility";
import { computeRiskFlags, frontierSpend, type RiskFlag } from "../metrics/risk";

const round2 = (n: number): number => Math.round(n * 100) / 100;

// --- the computed inputs (what the prompt is allowed to see) -----------------

export interface MemoSummary {
  org: string;
  periodLabel: string;
  currency: string;
  totalSpend: number;
  totalRequests: number;
  costPerRequest: number;
  frontierSpend: number;
  frontierShare: number;
  lowValueSpend: number;
  unapprovedSpend: number;
  missingOwnerSpend: number;
}

export interface MemoDriver {
  label: string;
  value: number;
  share: number;
  events: number;
}

export interface MemoInputs {
  summary: MemoSummary;
  /** Drivers that cleared the C1 data floor (safe for recommendations). */
  drivers: MemoDriver[];
  /** Excluded thin-data items (C1); the model must not recommend on these. */
  needsReview: NeedsReviewItem[];
  /** Quantified risk flags with dollar impact and a code-suggested control (D12). */
  riskFlags: RiskFlag[];
  /** B3 budget report (null when the dataset carries no budgets). */
  budget: BudgetReport | null;
  /** B3 forecast / scenarios. */
  forecast: Forecast | null;
  source: Source;
  periodStatus: string;
}

/** The model's output contract: language only, no numbers it must compute. */
export interface MemoNarrative {
  executive_summary: string[];
  driver_comment: string;
  risk_comment: string;
  budget_comment: string;
  forecast_comment: string;
  recommendations: { text: string; impact_note: string }[];
  questions: string[];
  data_sufficiency_comment: string;
}

/** Group events into team + workflow drivers with the C1 sufficiency signals. */
function computeDrivers(events: CanonicalUsageEvent[]): DriverDatum[] {
  const groups = new Map<string, { team: string; workflow: string; value: number; events: number; owned: boolean }>();
  for (const e of events) {
    const key = JSON.stringify([e.team, e.workflow]);
    const g = groups.get(key) ?? { team: e.team, workflow: e.workflow, value: 0, events: 0, owned: false };
    g.value += e.cost_usd;
    g.events += 1;
    if (e.project !== null) g.owned = true;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    team: g.team,
    workflow: g.workflow,
    value: round2(g.value),
    events: g.events,
    hasOwner: g.team !== "Unassigned" && g.owned,
  }));
}

/** Build the compact MemoInputs from a normalized dataset (runs client-side). */
export function buildMemoInputs(dataset: NorthstarDataset): MemoInputs {
  const events = dataset.events;
  const agg = computeAggregates(dataset);
  const total = agg.totalSpend;

  const fSpend = frontierSpend(events);
  const ctx = periodContext(dataset.meta);
  const budget =
    dataset.budgets && dataset.budgets.length > 0
      ? buildBudgetReport(dataset, ctx, "team")
      : null;
  const forecast = buildOutlook(dataset, ctx);

  const { eligible, needsReview } = partitionDrivers(computeDrivers(events));
  const drivers: MemoDriver[] = eligible.slice(0, 6).map((d) => ({
    label: d.label,
    value: d.value,
    share: total === 0 ? 0 : d.value / total,
    events: d.events,
  }));

  return {
    summary: {
      org: agg.org,
      periodLabel: agg.periodLabel,
      currency: agg.currency,
      totalSpend: round2(total),
      totalRequests: agg.totalRequests,
      costPerRequest: round2(agg.costPerRequest),
      frontierSpend: fSpend,
      frontierShare: total === 0 ? 0 : fSpend / total,
      lowValueSpend: round2(agg.lowValueSpend),
      unapprovedSpend: round2(agg.unapprovedSpend),
      missingOwnerSpend: round2(agg.missingOwnerSpend),
    },
    drivers,
    needsReview: needsReview.slice(0, 5),
    riskFlags: computeRiskFlags(events),
    budget,
    forecast,
    source: dataset.meta.source,
    periodStatus: dataset.meta.period_status,
  };
}

// --- control C2 input: the supplied figure set -------------------------------

/**
 * The flat set of every dollar figure present in the inputs, derived server-side
 * from the MemoInputs the model was shown. Control C2 validates that no dollar
 * figure in the model output falls outside this set (within rounding tolerance).
 */
export function collectMemoFigures(inputs: MemoInputs): number[] {
  const out: number[] = [];
  const push = (n: number | null | undefined) => {
    if (typeof n === "number" && Number.isFinite(n)) out.push(round2(n));
  };

  const s = inputs.summary;
  push(s.totalSpend);
  push(s.costPerRequest);
  push(s.frontierSpend);
  push(s.lowValueSpend);
  push(s.unapprovedSpend);
  push(s.missingOwnerSpend);

  for (const d of inputs.drivers) push(d.value);
  for (const f of inputs.riskFlags) push(f.impact_usd);

  if (inputs.budget) {
    const lines = [...inputs.budget.lines, inputs.budget.total];
    for (const l of lines) {
      push(l.budget);
      push(l.actual);
      push(l.expected);
      push(l.varianceToDate);
      push(l.projected);
      push(l.projectedVariance);
    }
  }

  if (inputs.forecast) {
    const f = inputs.forecast;
    push(f.actualToDate);
    push(f.runRate);
    push(f.recentTrend);
    push(f.projected);
    push(f.controlSavings);
    for (const sc of f.scenarios) push(sc.amount);
  }

  return [...new Set(out)];
}

// --- assemble the rendered memo (numbers app-injected, language from model) ---

const STATUS_WORD: Record<BudgetStatus, string> = {
  healthy: "healthy",
  "at-risk": "at risk",
  overrun: "over budget",
  "no-budget": "no budget set",
  early: "early, low confidence",
};

function sourceLabel(source: Source): string {
  if (source === "synthetic") return "Sample data";
  if (source === "real") return "Your data";
  return "Imported data";
}

interface Block {
  type: string;
  [key: string]: unknown;
}

/**
 * Compose the model's language with the code-computed numbers into the rendered
 * MemoDocument. Every dollar shown is app-injected from a supplied figure; the
 * model contributes only prose, which control C2 then validates.
 */
export function assembleMemo(inputs: MemoInputs, narrative: MemoNarrative): MemoDocument {
  const s = inputs.summary;
  const sections: { id: string; number: number; heading: string; blocks: Block[] }[] = [];
  let n = 0;
  const add = (id: string, heading: string, blocks: Block[]) => {
    sections.push({ id, number: ++n, heading, blocks });
  };

  add("executive-summary", "Executive summary",
    narrative.executive_summary.map((text) => ({ type: "paragraph", text })));

  add("cost-drivers", "Main cost drivers", [
    { type: "paragraph", text: narrative.driver_comment },
    {
      type: "table",
      columns: ["Workflow", "Spend", "Share"],
      rows: inputs.drivers.map((d) => ({ label: d.label, value_usd: d.value, share: d.share })),
    },
  ]);

  add("waste-risk", "Waste and risk areas", [
    { type: "paragraph", text: narrative.risk_comment },
    {
      type: "flags",
      items: inputs.riskFlags.map((f) => ({ label: f.label, detail: f.detail, impact_usd: f.impact_usd })),
    },
  ]);

  if (inputs.budget) {
    const budgeted = inputs.budget.lines.filter((l) => l.budget !== null);
    add("budget-variance", "Budget variance", [
      { type: "paragraph", text: narrative.budget_comment },
      {
        type: "list",
        ordered: false,
        items: budgeted.map((l) => ({
          text: `${l.key}: ${formatUSD(l.actual)} actual of ${formatUSD(l.budget ?? 0)} budget (${STATUS_WORD[l.status]}).`,
        })),
      },
    ]);
  } else if (narrative.budget_comment.trim() !== "") {
    add("budget-variance", "Budget variance", [
      { type: "paragraph", text: narrative.budget_comment },
    ]);
  }

  if (inputs.forecast) {
    add("forecast", "Forward outlook", [
      { type: "paragraph", text: narrative.forecast_comment },
      {
        type: "list",
        ordered: false,
        items: inputs.forecast.scenarios.map((sc) => ({ text: `${sc.label}: ${formatUSD(sc.amount)}.` })),
      },
    ]);
  }

  add("recommended-controls", "Recommended controls", [
    {
      type: "list",
      ordered: true,
      items: narrative.recommendations.map((r) => ({
        text: r.text,
        ...(r.impact_note && r.impact_note.trim() !== "" ? { impact_note: r.impact_note } : {}),
      })),
    },
  ]);

  add("questions", "Questions for department owners", [
    { type: "list", ordered: false, items: narrative.questions.map((text) => ({ text })) },
  ]);

  const doc: MemoDocument = {
    meta: {
      title: "AI Spend Review",
      period_label: s.periodLabel,
      org: s.org,
      prepared_by: "AI Spend CFO, by Aperio Finance",
      source_label: sourceLabel(inputs.source),
      cached: false,
      generated_note:
        "Generated live by an Opus-class model from your data. Every number is produced by the deterministic metrics layer and injected; the language is the model's. The output is validated so each dollar figure traces to a computed input (control C2).",
      scope_note: "",
    },
    headline: [
      { label: "Total AI spend", value_usd: s.totalSpend, sub: `${s.periodLabel}, all providers` },
      { label: "On frontier-tier models", value_usd: s.frontierSpend, sub: `${formatPercent(s.frontierShare)} of spend` },
      { label: "Low-value workflows", value_usd: s.lowValueSpend, sub: s.totalSpend ? `${formatPercent(s.lowValueSpend / s.totalSpend)} of spend` : "" },
      { label: "Unapproved spend", value_usd: s.unapprovedSpend, sub: s.totalSpend ? `${formatPercent(s.unapprovedSpend / s.totalSpend)} of spend` : "" },
    ],
    // The cast bridges the locally-built block shapes to the MemoView block union;
    // every field matches MemoView's BlockView cases.
    sections: sections as unknown as MemoDocument["sections"],
    needs_review:
      inputs.needsReview.length > 0
        ? inputs.needsReview
        : [{ label: "None", reason: "Every driver cited above cleared the data-sufficiency floor." }],
    needs_review_note:
      narrative.data_sufficiency_comment.trim() !== ""
        ? narrative.data_sufficiency_comment
        : "Items marked needs review lack sufficient data to assign a cause and are excluded from the recommendations. This is enforced in code, not left to the model.",
    figures: {
      total_spend: s.totalSpend,
      frontier_spend: s.frontierSpend,
      low_value_spend: s.lowValueSpend,
      unapproved_spend: s.unapprovedSpend,
      missing_owner_spend: s.missingOwnerSpend,
    },
  };

  return doc;
}
