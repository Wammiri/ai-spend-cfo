// Actor-to-team normalization mapping (D14). This IS the product's normalization
// value, so it is a visible, user-editable feature, not hidden config: the upload
// surface renders it as an editable table and recomputes the dashboard when it
// changes.
//
// A provider export (Anthropic Console, D5) only knows an actor (an API key label
// or workspace), not who owns it, what it is for, or whether it is sanctioned.
// The mapping resolves an actor into governance dimensions: team, workflow,
// environment, project, and a default value tier (D6/D14). An actor that matches
// no rule falls to "Unassigned" with a null project, which fires the
// missing-owner waste flag, exactly the gap finance needs surfaced.
//
// Value tiering (D6): the deterministic rule map here is the SOURCE OF TRUTH for
// value_tag. Haiku suggesting a tier for an unmapped workflow is the only AI step
// (classification, never computation) and is deferred to B4, where the API key
// exists. Until then, an unmapped workflow defaults to "medium" and is reported
// as such; nothing is silently invented.

import type {
  ApprovalStatus,
  Environment,
  RawUsageRow,
  ValueTag,
} from "../types";

/** One mapping rule: match an actor, assign its governance dimensions. */
export interface MappingRule {
  /** Substring matched case-insensitively against the actor (the common case). */
  match: string;
  /** "contains" (default) or "exact" actor match. */
  matchType?: "contains" | "exact";
  team: string;
  workflow: string;
  environment: Environment;
  /** Owning project, or null to deliberately leave ownerless (fires the flag). */
  project: string | null;
  value_tag: ValueTag;
}

export type ActorMapping = MappingRule[];

/** Governance dimensions resolved for one row. */
export interface ResolvedDimensions {
  team: string;
  workflow: string;
  environment: Environment;
  project: string | null;
  value_tag: ValueTag;
  approval_status: ApprovalStatus;
  /** True when no rule matched and the row fell to Unassigned (D14). */
  unmapped: boolean;
}

/** What an unmapped actor resolves to: ownerless, neutral value, prod by default. */
export const UNASSIGNED: Omit<ResolvedDimensions, "approval_status"> = {
  team: "Unassigned",
  workflow: "Unassigned",
  environment: "prod",
  project: null,
  value_tag: "medium",
  unmapped: true,
};

/**
 * Seeded default mapping. Rules are evaluated top to bottom; the first match
 * wins, so put more specific rules first. Users edit this in the upload surface.
 * Seeded to match the bundled sample export's actor labels so the demo resolves
 * out of the box, while one sample actor intentionally matches nothing to show
 * the missing-owner flag firing.
 */
export const DEFAULT_MAPPING: ActorMapping = [
  { match: "eng", team: "Engineering", workflow: "Code assistant", environment: "prod", project: "Platform", value_tag: "high" },
  { match: "data-science", team: "Data Science", workflow: "Model evaluation", environment: "experiment", project: "Research", value_tag: "medium" },
  { match: "ml-research", team: "Data Science", workflow: "Model evaluation", environment: "experiment", project: "Research", value_tag: "medium" },
  { match: "marketing", team: "Marketing", workflow: "Content generation", environment: "prod", project: "Demand Gen", value_tag: "low" },
  { match: "growth", team: "Marketing", workflow: "Content generation", environment: "prod", project: "Demand Gen", value_tag: "low" },
  { match: "support", team: "Customer Support", workflow: "Ticket summarization", environment: "prod", project: "Support Ops", value_tag: "high" },
  { match: "finance", team: "Finance", workflow: "FP&A analysis", environment: "prod", project: "FP&A", value_tag: "high" },
  { match: "sales", team: "Sales", workflow: "Outreach drafting", environment: "prod", project: "Pipeline", value_tag: "medium" },
  { match: "product", team: "Product", workflow: "Spec drafting", environment: "prod", project: "Roadmap", value_tag: "medium" },
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** First rule that matches the actor, or null. Exported for testing. */
export function matchRule(actor: string, mapping: ActorMapping): MappingRule | null {
  const a = norm(actor);
  for (const rule of mapping) {
    const m = norm(rule.match);
    if (rule.matchType === "exact" ? a === m : a.includes(m)) return rule;
  }
  return null;
}

/**
 * Resolve one row's governance dimensions (D14). A row that already carries
 * canonical dimensions (canonical CSV) keeps them; a provider-export row is
 * resolved from its actor via the mapping, falling to Unassigned when nothing
 * matches. Approval status is never inferred by the mapping (D14 does not own it):
 * a row's own value is honored, otherwise it defaults to "approved" so an export
 * with no approval signal is never falsely accused of unapproved spend.
 */
export function resolveDimensions(row: RawUsageRow, mapping: ActorMapping): ResolvedDimensions {
  const approval_status: ApprovalStatus = row.approval_status ?? "approved";

  // Canonical rows already carry their dimensions; honor them verbatim.
  if (row.team !== undefined && row.team !== "") {
    return {
      team: row.team,
      workflow: row.workflow ?? "Unspecified",
      environment: row.environment ?? "prod",
      project: row.project ?? null,
      value_tag: row.value_tag ?? "medium",
      approval_status,
      unmapped: false,
    };
  }

  const rule = matchRule(row.actor, mapping);
  if (rule) {
    return {
      team: rule.team,
      workflow: rule.workflow,
      environment: rule.environment,
      project: rule.project,
      value_tag: rule.value_tag,
      approval_status,
      unmapped: false,
    };
  }

  return { ...UNASSIGNED, approval_status };
}

/** Distinct actors across rows, in first-seen order (for the mapping editor). */
export function distinctActors(rows: RawUsageRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (!seen.has(r.actor)) {
      seen.add(r.actor);
      out.push(r.actor);
    }
  }
  return out;
}
