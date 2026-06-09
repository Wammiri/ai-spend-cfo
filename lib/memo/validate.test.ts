import { describe, it, expect } from "vitest";
import type { MemoDocument } from "@/components/memo-view";
import {
  findUnsupportedFigures,
  isSupported,
  sanitizeMemo,
  validateMemo,
} from "./validate";

// Control C2 test (DISCOVERY section 8, CLAUDE.md): no unsupported dollar figure
// may survive in the returned memo. We prove BOTH the allowed case (a figure that
// traces to a supplied input survives untouched) and the forbidden case (a
// fabricated figure is flagged and stripped).

function memoWithParagraph(text: string): MemoDocument {
  return {
    meta: {
      title: "AI Spend Review",
      period_label: "May 2026",
      org: "Test Org",
      prepared_by: "AI Spend CFO",
      source_label: "Imported data",
      cached: false,
      generated_note: "",
      scope_note: "",
    },
    headline: [],
    sections: [
      {
        id: "executive-summary",
        number: 1,
        heading: "Executive summary",
        blocks: [{ type: "paragraph", text }],
      },
    ],
    needs_review: [],
    needs_review_note: "",
    figures: {},
  };
}

describe("isSupported (rounding tolerance)", () => {
  it("accepts a figure within rounding of a supplied number (allowed)", () => {
    expect(isSupported(6260, [6260.1])).toBe(true);
    expect(isSupported(2145.2, [2145.2])).toBe(true);
  });
  it("rejects a fabricated figure (forbidden)", () => {
    expect(isSupported(9999, [6260.1])).toBe(false);
    expect(isSupported(1000, [1500])).toBe(false);
  });
});

describe("findUnsupportedFigures", () => {
  it("returns only the dollar figures that trace to no input", () => {
    expect(
      findUnsupportedFigures("Spend was $6,260 with $9,999 of waste.", [6260.1]),
    ).toEqual([9999]);
  });
  it("ignores percentages (only dollar figures are validated)", () => {
    expect(findUnsupportedFigures("That is 79% of spend.", [])).toEqual([]);
  });
});

describe("sanitizeMemo (C2 enforcement)", () => {
  it("leaves a supported figure untouched (the allowed case survives)", () => {
    const supplied = [6260.1, 2145.2];
    const doc = memoWithParagraph("Total spend was $6,260; frontier savings were $2,145.");
    const { memo, validation } = sanitizeMemo(doc, supplied);
    expect(validation.ok).toBe(true);
    expect(validation.flagged).toEqual([]);
    const para = memo.sections[0].blocks[0] as { text: string };
    expect(para.text).toContain("$6,260");
    expect(para.text).toContain("$2,145");
  });

  it("strips an unsupported figure (the forbidden case never survives)", () => {
    const supplied = [6260.1];
    const doc = memoWithParagraph("Total spend was $6,260 but waste reached $9,999.");
    const { memo, validation } = sanitizeMemo(doc, supplied);
    expect(validation.ok).toBe(false);
    expect(validation.flagged).toContain(9999);
    const para = memo.sections[0].blocks[0] as { text: string };
    expect(para.text).toContain("$6,260"); // supported figure kept
    expect(para.text).not.toContain("$9,999"); // fabricated figure removed
    expect(para.text).toMatch(/withheld pending review/);
  });

  it("validateMemo reports without mutating", () => {
    const doc = memoWithParagraph("Waste was $9,999.");
    const result = validateMemo(doc, [6260.1]);
    expect(result.ok).toBe(false);
    const para = doc.sections[0].blocks[0] as { text: string };
    expect(para.text).toContain("$9,999"); // original doc unchanged
  });
});
