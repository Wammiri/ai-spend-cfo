// Control C2 (DISCOVERY section 8, CLAUDE.md): the memo number-integrity pass.
// The route computes all numbers, injects only those, then post-validates the
// model's output so every dollar figure it emits traces to a supplied input. Any
// dollar figure that does not is flagged and stripped, so no unsupported figure
// survives in the returned memo. This enforces the core architectural law: the
// AI never asserts a number it was not given (DISCOVERY section 4, law 1).
//
// Scope: dollar figures only ("every dollar figure" per the control). Percentages
// and counts are app-injected from supplied figures and are not model-asserted.
// Tolerance allows ordinary rounding (the model may write $6,260 for $6,260.10)
// but rejects fabricated amounts.

import type { MemoDocument } from "@/components/memo-view";

/** Matches a dollar amount like $1,234.56 or $ 1234 (optional sign). */
const DOLLAR_RE = /\$\s?-?\d[\d,]*(?:\.\d+)?/g;

const WITHHELD = "(figure withheld pending review)";

/** A figure the model emitted that traces to no supplied input. */
export interface MemoValidation {
  ok: boolean;
  /** The unsupported dollar values that were flagged (and stripped). */
  flagged: number[];
}

function parseDollarToken(token: string): number | null {
  const n = Number(token.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const tolerance = (n: number): number => Math.max(1, Math.abs(n) * 0.005);

/** True when `value` is within rounding tolerance of any supplied figure. */
export function isSupported(value: number, supplied: number[]): boolean {
  return supplied.some((s) => Math.abs(value - s) <= Math.max(tolerance(value), tolerance(s)));
}

/** Every dollar value in `text` that is NOT traceable to a supplied figure. */
export function findUnsupportedFigures(text: string, supplied: number[]): number[] {
  const out: number[] = [];
  for (const m of text.match(DOLLAR_RE) ?? []) {
    const v = parseDollarToken(m);
    if (v !== null && !isSupported(v, supplied)) out.push(v);
  }
  return out;
}

function scrubString(text: string, supplied: number[], removed: number[]): string {
  return text.replace(DOLLAR_RE, (m) => {
    const v = parseDollarToken(m);
    if (v === null || isSupported(v, supplied)) return m;
    removed.push(v);
    return WITHHELD;
  });
}

function deepScrub(value: unknown, supplied: number[], removed: number[]): unknown {
  if (typeof value === "string") return scrubString(value, supplied, removed);
  if (Array.isArray(value)) return value.map((v) => deepScrub(v, supplied, removed));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepScrub(v, supplied, removed);
    return out;
  }
  return value;
}

/** Report any unsupported dollar figure in the memo without mutating it. */
export function validateMemo(doc: MemoDocument, supplied: number[]): MemoValidation {
  const flagged: number[] = [];
  deepScrub(structuredClone(doc), supplied, flagged);
  return { ok: flagged.length === 0, flagged };
}

/**
 * Strip every unsupported dollar figure from the memo's prose, replacing it with
 * a withheld marker, and report what was removed. This is the C2 enforcement step
 * the route applies before returning: no unsupported figure survives.
 */
export function sanitizeMemo(
  doc: MemoDocument,
  supplied: number[],
): { memo: MemoDocument; validation: MemoValidation } {
  const flagged: number[] = [];
  const memo = deepScrub(structuredClone(doc), supplied, flagged) as MemoDocument;
  return { memo, validation: { ok: flagged.length === 0, flagged } };
}
