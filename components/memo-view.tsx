import {
  formatPercent,
  formatUSD,
  stripEmDashes as strip,
} from "@/lib/metrics/aggregate";

// The hero artifact (DISCOVERY section 1): the CFO memo, rendered as a
// board-grade typeset document. Content is the cached precomputed-memo.json
// (D3, no live call on the sample path). Every dollar figure traces to the
// deterministic metrics layer; the language is the AI's. House rule: all
// rendered prose passes through stripEmDashes.

type Block =
  | { type: "paragraph"; text: string }
  | {
      type: "table";
      columns: string[];
      rows: { label: string; value_usd: number; share: number }[];
    }
  | {
      type: "flags";
      items: { label: string; detail: string; impact_usd: number }[];
    }
  | {
      type: "list";
      ordered: boolean;
      items: { text: string; impact_note?: string }[];
    };

interface MemoSection {
  id: string;
  number: number;
  heading: string;
  blocks: Block[];
}

export interface MemoDocument {
  meta: {
    title: string;
    period_label: string;
    org: string;
    prepared_by: string;
    source_label: string;
    cached: boolean;
    generated_note: string;
    scope_note: string;
  };
  headline: { label: string; value_usd: number; sub: string }[];
  sections: MemoSection[];
  needs_review: { label: string; reason: string }[];
  needs_review_note: string;
  figures: Record<string, number>;
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="mt-3 text-[15px] leading-7 text-ink-soft first:mt-0">
          {strip(block.text)}
        </p>
      );

    case "table":
      return (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline-strong text-left text-[11px] uppercase tracking-[0.1em] text-muted">
              {block.columns.map((c, i) => (
                <th
                  key={c}
                  className={`py-2 font-medium ${i === 0 ? "" : "text-right"}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.label} className="border-b border-hairline/70 last:border-0">
                <td className="py-2.5 pr-3 text-ink-soft">{strip(r.label)}</td>
                <td className="tnum py-2.5 text-right font-medium text-ink">
                  {formatUSD(r.value_usd)}
                </td>
                <td className="tnum py-2.5 text-right text-muted">
                  {formatPercent(r.share)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "flags":
      return (
        <ul className="mt-4 space-y-3">
          {block.items.map((f) => (
            <li
              key={f.label}
              className="flex items-start justify-between gap-4 border-l-2 border-risk/50 bg-risk-wash/40 py-2 pl-3 pr-2"
            >
              <div>
                <p className="text-sm font-medium text-ink">{strip(f.label)}</p>
                <p className="mt-0.5 text-sm leading-6 text-muted">{strip(f.detail)}</p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold text-risk">
                {formatUSD(f.impact_usd)}
              </span>
            </li>
          ))}
        </ul>
      );

    case "list":
      if (block.ordered) {
        return (
          <ol className="mt-4 space-y-3">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-7 text-ink-soft">
                <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-wash text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <span>
                  {strip(it.text)}
                  {it.impact_note ? (
                    <span className="ml-1.5 text-sm font-medium text-accent">
                      ({strip(it.impact_note)})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="mt-4 space-y-2.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-7 text-ink-soft">
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{strip(it.text)}</span>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
}

export function MemoView({ memo }: { memo: MemoDocument }) {
  const { meta } = memo;
  return (
    <article className="relative overflow-hidden rounded-md border border-hairline bg-surface shadow-lift">
      <div className="h-1 w-full bg-accent" aria-hidden />
      <div className="px-7 py-9 sm:px-14 sm:py-12">
        {/* document header */}
        <header className="border-b border-hairline pb-6">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
              Aperio Finance · AI Spend CFO
            </p>
            {meta.cached ? (
              <span className="rounded-sm border border-caution/40 bg-caution-wash px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-caution">
                {meta.source_label}
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 font-serif text-3xl tracking-tight text-ink sm:text-4xl">
            {strip(meta.title)}
            <span className="text-faint"> · {meta.period_label}</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {strip(meta.org)} · prepared by {strip(meta.prepared_by)}
          </p>
        </header>

        {/* headline figures */}
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline lg:grid-cols-4">
          {memo.headline.map((h) => (
            <div key={h.label} className="bg-surface px-4 py-3">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">
                {strip(h.label)}
              </dt>
              <dd className="tnum mt-1 text-xl font-semibold tracking-tight text-ink">
                {formatUSD(h.value_usd)}
              </dd>
              <dd className="mt-0.5 text-xs text-faint">{strip(h.sub)}</dd>
            </div>
          ))}
        </dl>

        {/* sections */}
        <div className="mt-9 space-y-9">
          {memo.sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id}>
              <h2
                id={s.id}
                className="flex items-baseline gap-2.5 font-serif text-xl tracking-tight text-ink"
              >
                <span className="tnum text-base font-semibold text-accent">
                  {s.number}.
                </span>
                {strip(s.heading)}
              </h2>
              <div className="mt-2">
                {s.blocks.map((b, i) => (
                  <BlockView key={i} block={b} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* honesty stance: in-code needs-review exclusion (C1 / credibility gate) */}
        <aside className="mt-9 rounded-md border border-accent/25 bg-accent-wash/60 px-5 py-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            On data sufficiency
          </h3>
          <ul className="mt-2 space-y-1.5">
            {memo.needs_review.map((n) => (
              <li key={n.label} className="text-sm leading-6 text-ink-soft">
                <span className="font-medium">{strip(n.label)}.</span>{" "}
                {strip(n.reason)}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-accent/15 pt-3 text-xs italic leading-5 text-muted">
            {strip(memo.needs_review_note)}
          </p>
        </aside>

        <footer className="mt-8 border-t border-hairline pt-4 text-xs leading-5 text-faint">
          {strip(meta.generated_note)} {strip(meta.scope_note)}
        </footer>
      </div>
    </article>
  );
}
