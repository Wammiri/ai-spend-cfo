# DISCOVERY: finance-report-pdf skill (global, reusable)

**Version:** 1.0
**Date:** 2026-06-09
**Mode:** New build, from a grill (the grill-me interview on 2026-06-09).
**Status:** Discovery complete. Pending authoring with `write-a-skill` in its own focused session. This is a standalone, cross-project asset; it is NOT part of the AI Spend CFO batch sequence. AI Spend CFO is only its first consumer.
**Eventual home:** `C:\Users\HP\.claude\skills\finance-report-pdf\` (global, available to every project). This file is the seed discovery and moves there when the skill is authored.

House rule observed: no em dashes.

---

## 1. What it is

A global Claude skill that turns finalized finance content into a board-grade, bulge-bracket-quality PDF document. The target craft bar is "JP Morgan standard." It is reusable across all Aperio Finance products and any project that needs finance-style output. First consumer: the AI Spend CFO "CFO memo."

- **Slug:** `finance-report-pdf`
- **Working title:** Board-grade finance reports and memos (PDF)

## 2. Scope: document archetypes (Q1)

In v1, portrait and multi-page:
- **Executive memo / brief:** 1 to 6 pages, prose-led with key figures inline (the AI Spend CFO memo).
- **Multi-page analytical report:** the real "no page limits" case. Data plus prose, numbered sections, tables and exhibits, charts, sources. This is where the craft shows.

Out of v1 (recorded in non-goals): tearsheet / one-pager (a later constrained layout variant), landscape pitch decks (a separate sibling skill, different layout engine).

## 3. Interface: the content / rendering split (Q2)

One canonical **document schema** (a typed intermediate representation). A consumer hands the skill content plus a theme; the skill owns 100% of the craft.

- **Schema:** document metadata plus an ordered list of typed blocks: `section`, `heading`, `prose`, `table`/`exhibit`, `chart`, `kpi_strip`, `callout`, `footnote`, `page_break`, `appendix`.
- **Two front doors compile into the schema:** markdown-with-front-matter (for humans and LLMs to draft by hand) and JSON (for apps to emit programmatically).
- **The renderer only ever sees the schema.** This is the reuse mechanism and it mirrors the exact normalization insight AI Spend CFO is built on (one canonical shape, many sources).

## 4. Page furniture (Q3, all bundles in)

- **Core report frame:** cover page (title, subtitle, date, prepared-for/by, logo), numbered sections (1, 1.1), running headers/footers, page numbers, appendices, and an auto table of contents with resolved page numbers.
- **Exhibit system:** auto-numbered exhibits/figures/tables ("Exhibit 1: ...") with captions and a source/notes line beneath each, plus cross-references ("see Exhibit 3").
- **Annotations:** true page-bottom footnotes, a sources/disclaimer block, and endnotes.
- **Status and confidential marks:** "Strictly Private and Confidential" marking, an optional DRAFT watermark, dated prepared-for/by lines.

These commit the engine to two-pass rendering (TOC and cross-references) and true footnotes, which is what selected Typst in thread 6.

## 5. Theming and branding (Q4)

A token-based theme layer: typefaces, palette, logo, cover treatment, header/footer style, table and exhibit styling, number locale, page size. The **Aperio house theme** ships as the default; any project passes its own theme to override the brand while inheriting every bit of craft.

- Print-first. Restrained palette: near-black ink, a single accent, a disciplined gray scale, red and green reserved strictly for variance. No dark mode.
- Page size: default US Letter, A4 available as a theme token.

## 6. Typography and number conventions (Q5)

- **Typefaces:** a curated open, OFL-licensed superfamily with true tabular figures, embeddable with zero licensing risk. Lead candidate: Source Serif 4 (body) plus Inter (labels/tables) plus IBM Plex Mono (figures), or the IBM Plex serif/sans/mono trio. An Aperio brand typeface slots into the house theme if one is provided and its license permits PDF embedding.
- **Number conventions (baked into the default locale):** parentheses for negatives, currency scaling with unit notes ("$ in millions"), bps for small rates, decimal-aligned tabular figures, per-metric precision rules, nil shown as a hyphen (not an em dash), "NM" and "n/a" tokens, en-US default.
- **House style:** the no-em-dash rule is enforced on output text (stripped), consistent with all Aperio output.

## 7. Engine (Q6)

**Typst.** Native table of contents, section numbering, cross-references, footnotes, running heads, and figure numbering. Programmatic theming (the canonical schema compiles straight into a Typst template). Embeds OFL fonts. Fast single binary, no TeX bloat. Its WebAssembly build (`typst.ts`) lets the **same template render at dev-time (binary) and at runtime in a web app (wasm)**, which dissolves the dev-time-versus-runtime gap. This supersedes `@react-pdf/renderer` in the AI Spend CFO stack.

## 8. Truth boundary (Q7, the credibility control)

A **strict typesetter**. It formats only (rounding, scaling, sign, percent, bps, decimal alignment) per the theme's number locale. It never derives a financial value: no summing columns, no variances, no growth rates. Every figure, including every total and subtotal, is supplied by the consumer. Single source of truth. This mirrors the AI Spend CFO architectural law (code computes, the presentation layer never invents a number).

## 9. Charts and exhibits (Q8)

The skill **renders a curated set of themed, vector, print-grade chart exhibits natively in Typst** from data the consumer supplies: column/bar, line, stacked and 100%-stacked, share, and a variance bridge/waterfall. Plus an **image/SVG passthrough escape hatch** for custom exhibits. Charts share the document's exact fonts, palette, and number formatting, stay vector, and read bank-made.

## 10. Output (Q9)

Emits **both** the compiled PDF (fonts embedded) and the **editable Typst source** (template plus content), so outputs are hand-finishable, not a black box.

## 11. Reuse mechanics and runtime (Q10)

**Skill contents (global home):** `SKILL.md`, `template/` (Typst template library: cover, sections, furniture, exhibit system, footnotes), `theme/` (token themes; `aperio.typ` default), `schema/` (canonical schema plus a JSON Schema), `compile/` (markdown to schema, schema to Typst), `charts/` (the curated vector set), `fonts/` (bundled OFL fonts), `examples/` (sample documents including the CFO memo).

**Adoption by a project:** provide content (markdown or JSON matching the schema) plus an optional theme override, receive a PDF plus source. For a web app: bundle `typst.ts` wasm plus the template, theme, and fonts, and render at runtime.

**AI Spend CFO consumption:** at dev-time the skill generates the committed hero memo PDF (`data/precomputed-memo.pdf`). The live "Download PDF" wires to `typst.ts` (client-side wasm compile recommended: reliable, zero server cost) rendering the same template from the app's computed memo content (canonical schema JSON). `@react-pdf/renderer` is dropped.

## 12. v1 non-goals (Q11, recorded with triggers)

| Item | Decision | Trigger that would change it |
|---|---|---|
| Landscape pitch decks | Out of v1; a sibling skill. | A real need for slide-style output. |
| Word (.docx) / PowerPoint export | Out; PDF-first. | A consumer requires an editable Office handoff. |
| Interactive / HTML report output | Out. | A web-native report requirement. |
| Live data binding / streaming | Out by design; the skill takes finalized content. | Never, by the truth-boundary design. |
| Multi-language / RTL / CJK typesetting | Out of v1. | A localized report requirement (Typst can support it later). |
| Skill computing figures | Excluded permanently (thread 8). | Never. |
| GUI editor | Out. | None planned. |
| PDF/A archival compliance | Out of v1. | An archival or regulatory requirement. |

## 13. Controls (made enforceable, not prose)

| Control | Risk it prevents | Where enforced | Test |
|---|---|---|---|
| Strict typesetter (truth boundary) | The document showing a figure the source system never produced. | The schema-to-Typst compiler passes figures through verbatim; no arithmetic on values. | Feed content, assert every figure in the rendered PDF traces to an input value. |
| Font embedding | A document that renders differently on another machine (broken JPM look). | Typst embeds the theme fonts in every output. | Assert the output PDF embeds its fonts (no system-font fallback). |
| House style (no em dashes) | Off-house punctuation in finance output. | Output text is stripped of em dashes deterministically. | Assert no em dash survives in rendered text. |

## 14. Build approach

Authored via `write-a-skill` in its own focused session. It is a real build (Typst template library, Aperio theme tokens, the canonical schema plus both compilers, the curated vector chart set, bundled OFL fonts, and worked examples), so it is its own side quest with its own verification, not folded into AI Spend CFO. AI Spend CFO's B5 only integrates and consumes it.

---

*End of finance-report-pdf DISCOVERY v1.0.*
