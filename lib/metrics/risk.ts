// Quantified waste and risk flags with model-tier repricing (B4, D12 / DISCOVERY
// section 7). Architectural law (CLAUDE.md, DISCOVERY section 4): code computes
// every number; the AI never calculates. This module produces every risk flag
// and its dollar impact deterministically from the canonical events. The memo
// route injects these numbers; the model only turns them into language.
//
// Tier repricing (D12): a static, editable map keys provider+model into
// frontier / mid / cheap with a recommended cheaper target per frontier and mid
// model. "Expensive-model misuse" savings = current cost of low-value spend on a
// frontier model minus the same tokens repriced at the recommended cheaper
// target (selectPrice + deriveCost, the same canonical cost engine). No AI is in
// the number.

import type { CanonicalUsageEvent, ModelTier, PricingRow } from "../types";
import { PRICING_TABLE, selectPrice } from "../pricing/pricing-table";
import { deriveCost } from "./cost";

/** One model's tier and, where it makes sense, the cheaper model to reprice to. */
export interface TierInfo {
  tier: ModelTier;
  /** Recommended cheaper target to reprice misused spend against (D12). */
  target?: { provider: string; model: string };
}

/**
 * Static, editable tier map (D12), keyed "provider/model". The tiers match the
 * Northstar sample's model tiers so the live memo reconciles with the dashboard,
 * and cover the common cross-provider models the pricing table can price. Editing
 * a row (or adding a model) is a one-line change here.
 */
export const MODEL_TIERS: Record<string, TierInfo> = {
  "anthropic/claude-opus-4-8": { tier: "frontier", target: { provider: "anthropic", model: "claude-sonnet-4-6" } },
  "anthropic/claude-sonnet-4-6": { tier: "mid", target: { provider: "anthropic", model: "claude-haiku-4-5" } },
  "anthropic/claude-haiku-4-5": { tier: "cheap" },
  "openai/gpt-5": { tier: "frontier", target: { provider: "openai", model: "gpt-5-mini" } },
  "openai/gpt-5-mini": { tier: "mid" },
  "google/gemini-2.5-pro": { tier: "frontier", target: { provider: "google", model: "gemini-2.5-flash" } },
  "google/gemini-2.5-flash": { tier: "cheap" },
};

const round2 = (n: number): number => Math.round(n * 100) / 100;
const norm = (s: string): string => s.trim().toLowerCase();

/** Tier + cheaper target for a model, or null when the model is unmapped. */
export function tierInfoFor(provider: string, model: string): TierInfo | null {
  return MODEL_TIERS[`${norm(provider)}/${norm(model)}`] ?? null;
}

/** Tier for a model; unmapped models fall to "mid" (never silently "frontier"). */
export function tierOf(provider: string, model: string): ModelTier {
  return tierInfoFor(provider, model)?.tier ?? "mid";
}

/** Total frontier-tier spend across events (memo headline metric). */
export function frontierSpend(events: CanonicalUsageEvent[]): number {
  return round2(
    events.reduce((s, e) => (tierOf(e.provider, e.model) === "frontier" ? s + e.cost_usd : s), 0),
  );
}

export interface TierRepricing {
  /** Current cost of the frontier, low-value spend that has a cheaper target. */
  consideredSpend: number;
  /** What those exact tokens would cost on the recommended cheaper target. */
  repricedCost: number;
  /** Savings = consideredSpend - repricedCost, never negative. */
  savings: number;
  /** Number of events repriced (had a frontier tier, low value, and a target price). */
  events: number;
}

/**
 * Reprice the low-value spend running on frontier-tier models at the recommended
 * cheaper target (D12). Only events whose target model has a price row are
 * counted, so the savings figure is always well defined and never guessed.
 */
export function computeTierRepricing(
  events: CanonicalUsageEvent[],
  table: readonly PricingRow[] = PRICING_TABLE,
): TierRepricing {
  let consideredSpend = 0;
  let repricedCost = 0;
  let count = 0;

  for (const e of events) {
    if (e.value_tag !== "low") continue;
    const info = tierInfoFor(e.provider, e.model);
    if (!info || info.tier !== "frontier" || !info.target) continue;
    const targetPrice = selectPrice(info.target.provider, info.target.model, e.date, table);
    if (!targetPrice) continue;
    consideredSpend += e.cost_usd;
    repricedCost += deriveCost(e, targetPrice);
    count++;
  }

  consideredSpend = round2(consideredSpend);
  repricedCost = round2(repricedCost);
  return {
    consideredSpend,
    repricedCost,
    savings: Math.max(0, round2(consideredSpend - repricedCost)),
    events: count,
  };
}

/** One quantified risk flag. `detail` and `recommendation` are code-derived. */
export interface RiskFlag {
  key: string;
  label: string;
  /** Factual framing, deliberately free of dollar amounts (the dollar is impact_usd). */
  detail: string;
  /** Dollar exposure or savings for this flag (credibility checklist). */
  impact_usd: number;
  /** A code-suggested control, handed to the model as the recommendation seed. */
  recommendation: string;
}

const sumWhere = (
  events: CanonicalUsageEvent[],
  pred: (e: CanonicalUsageEvent) => boolean,
): number => round2(events.reduce((s, e) => (pred(e) ? s + e.cost_usd : s), 0));

/**
 * The single largest daily spend that exceeds three times the trailing seven-day
 * average (DISCOVERY section 7). Returns null when no day spikes, so the flag is
 * only raised when the data supports it.
 */
function usageSpike(events: CanonicalUsageEvent[]): { date: string; amount: number } | null {
  const byDay = new Map<string, number>();
  for (const e of events) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.cost_usd);
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let worst: { date: string; amount: number } | null = null;
  for (let i = 0; i < days.length; i++) {
    const window = days.slice(Math.max(0, i - 7), i);
    if (window.length === 0) continue;
    const avg = window.reduce((s, d) => s + d[1], 0) / window.length;
    const [date, amount] = days[i];
    if (avg > 0 && amount > 3 * avg && (!worst || amount > worst.amount)) {
      worst = { date, amount: round2(amount) };
    }
  }
  return worst;
}

/**
 * Compute every quantified waste / risk flag from the events (B4). Each flag is
 * emitted only when its dollar impact is positive, so the memo never shows a
 * zero-dollar flag. Flags overlap (a workflow can be low-value, unapproved, and
 * ownerless at once), so they are exposure measures, not a sum.
 */
export function computeRiskFlags(
  events: CanonicalUsageEvent[],
  table: readonly PricingRow[] = PRICING_TABLE,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  const reprice = computeTierRepricing(events, table);
  if (reprice.savings > 0) {
    flags.push({
      key: "frontier-misuse",
      label: "Frontier models on low-value work",
      detail:
        "Low-value workflows ran on frontier-tier models. Routing them to the recommended cheaper tier is the single largest savings opportunity, repriced from the same token volume.",
      impact_usd: reprice.savings,
      recommendation: "Route low-complexity, low-value workflows off frontier-tier models onto the recommended cheaper tier.",
    });
  }

  const lowValue = sumWhere(events, (e) => e.value_tag === "low");
  if (lowValue > 0) {
    flags.push({
      key: "low-value",
      label: "Low-value spend",
      detail: "Workflows tagged low value consumed this share of spend, regardless of model tier.",
      impact_usd: lowValue,
      recommendation: "Review low-value workflows for necessity and move retained ones to a cheaper tier.",
    });
  }

  const unapproved = sumWhere(events, (e) => e.approval_status === "unapproved");
  if (unapproved > 0) {
    flags.push({
      key: "unapproved",
      label: "Unapproved spend",
      detail: "Spend ran without an approval, concentrated in the experiment environment.",
      impact_usd: unapproved,
      recommendation: "Require an approval for any spend in the experiment environment.",
    });
  }

  const missingOwner = sumWhere(events, (e) => e.project === null);
  if (missingOwner > 0) {
    flags.push({
      key: "missing-owner",
      label: "Missing owner",
      detail: "Spend carried no project owner and cannot be attributed to a budget holder.",
      impact_usd: missingOwner,
      recommendation: "Assign a project owner to every workflow and block ingestion of ownerless usage.",
    });
  }

  const spike = usageSpike(events);
  if (spike) {
    flags.push({
      key: "usage-spike",
      label: `Usage spike on ${spike.date}`,
      detail: "One day's spend exceeded three times the trailing seven-day average.",
      impact_usd: spike.amount,
      recommendation: `Investigate the ${spike.date} spike and confirm it was intended.`,
    });
  }

  return flags;
}
