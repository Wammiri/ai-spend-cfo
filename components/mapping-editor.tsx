"use client";

import type { ValueTag } from "@/lib/types";
import {
  resolveDimensions,
  type ActorMapping,
  type MappingRule,
} from "@/lib/mapping/actor-team";
import { formatUSD } from "@/lib/metrics/aggregate";

// The actor-to-team mapping made visible and editable (D14). A provider export
// only knows an API key; this table is where finance assigns ownership, so it is
// a feature, not hidden config. Editing an actor recomputes the whole dashboard
// (the parent owns the mapping state). An unmapped actor is flagged: it is the
// missing-owner gap the product exists to surface.

const TEAM_OPTIONS = [
  "Engineering",
  "Data Science",
  "Marketing",
  "Product",
  "Customer Support",
  "Finance",
  "Sales",
  "Unassigned",
];

/** Upsert an exact-match rule for one actor at the front, so it wins immediately. */
function upsertRule(mapping: ActorMapping, actor: string, patch: Partial<MappingRule>): ActorMapping {
  const without = mapping.filter((r) => !(r.matchType === "exact" && r.match === actor));
  const current = resolveDimensions(
    { actor, date: "", provider: "", model: "", input_tokens: 0, output_tokens: 0, requests: 0, source: "provider-export" },
    mapping,
  );
  const rule: MappingRule = {
    match: actor,
    matchType: "exact",
    team: patch.team ?? current.team,
    workflow: patch.workflow ?? current.workflow,
    environment: patch.environment ?? current.environment,
    project: patch.project !== undefined ? patch.project : current.project,
    value_tag: patch.value_tag ?? current.value_tag,
  };
  return [rule, ...without];
}

export function MappingEditor({
  actors,
  spendByActor,
  mapping,
  onChange,
}: {
  actors: string[];
  spendByActor: Map<string, number>;
  mapping: ActorMapping;
  onChange: (next: ActorMapping) => void;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface shadow-card">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-ink">Owner mapping</h2>
        <p className="mt-0.5 text-xs text-muted">
          Assign each API key to a team, project, and value tier. Unmapped keys fall to
          Unassigned and fire the missing-owner flag. Edits update the dashboard live.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted">
              <th className="px-4 py-2 font-semibold">API key / actor</th>
              <th className="px-4 py-2 font-semibold">Team</th>
              <th className="px-4 py-2 font-semibold">Project</th>
              <th className="px-4 py-2 font-semibold">Value</th>
              <th className="px-4 py-2 text-right font-semibold">Spend</th>
            </tr>
          </thead>
          <tbody>
            {actors.map((actor) => {
              const dims = resolveDimensions(
                { actor, date: "", provider: "", model: "", input_tokens: 0, output_tokens: 0, requests: 0, source: "provider-export" },
                mapping,
              );
              return (
                <tr key={actor} className="border-t border-hairline align-middle">
                  <td className="px-4 py-2">
                    <span className="font-medium text-ink">{actor}</span>
                    {dims.unmapped ? (
                      <span className="ml-2 inline-flex items-center rounded-sm border border-risk/40 bg-risk-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-risk">
                        Unassigned
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Team for ${actor}`}
                      value={dims.team}
                      onChange={(e) => onChange(upsertRule(mapping, actor, { team: e.target.value }))}
                      className="w-full rounded-md border border-hairline bg-paper px-2 py-1 text-sm text-ink"
                    >
                      {(TEAM_OPTIONS.includes(dims.team) ? TEAM_OPTIONS : [dims.team, ...TEAM_OPTIONS]).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      aria-label={`Project for ${actor}`}
                      value={dims.project ?? ""}
                      placeholder="(none)"
                      onChange={(e) => onChange(upsertRule(mapping, actor, { project: e.target.value.trim() === "" ? null : e.target.value }))}
                      className="w-full rounded-md border border-hairline bg-paper px-2 py-1 text-sm text-ink placeholder:text-faint"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Value tier for ${actor}`}
                      value={dims.value_tag}
                      onChange={(e) => onChange(upsertRule(mapping, actor, { value_tag: e.target.value as ValueTag }))}
                      className="w-full rounded-md border border-hairline bg-paper px-2 py-1 text-sm text-ink"
                    >
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </td>
                  <td className="tnum px-4 py-2 text-right text-muted">{formatUSD(spendByActor.get(actor) ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-faint">
        Environment defaults to the seeded rule. Value-tier suggestions for
        unmapped workflows (Haiku classification) arrive with the live memo.
      </p>
    </div>
  );
}
