import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  looksLikeAnthropicExport,
  parseAnthropicConsole,
} from "./anthropic-console";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "../../public", rel), "utf8");

describe("parseAnthropicConsole (D5)", () => {
  it("parses the bundled sample export into canonical-bound rows", () => {
    const { rows, issues, format } = parseAnthropicConsole(read("sample-anthropic-export.csv"), "synthetic");
    expect(format).toBe("anthropic-console");
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(rows).toHaveLength(8);
    const first = rows[0];
    expect(first.provider).toBe("anthropic");
    expect(first.actor).toBe("eng-prod-key");
    expect(first.reported_cost_usd).toBe(30);
    // dimensions are NOT set by the parser; the mapping resolves them later
    expect(first.team).toBeUndefined();
    expect(first.source).toBe("synthetic");
  });

  it("captures cache-read tokens when present", () => {
    const { rows } = parseAnthropicConsole(read("sample-anthropic-export.csv"), "synthetic");
    const support = rows.find((r) => r.actor === "support-bot-key");
    expect(support?.cached_input_tokens).toBe(2_000_000);
  });

  it("errors when the file is not an Anthropic export", () => {
    const { rows, issues } = parseAnthropicConsole("foo,bar\n1,2\n");
    expect(rows).toHaveLength(0);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/Anthropic Console export/);
  });

  it("accepts the alias column names from COLUMN_MAP (format reconfirm seam)", () => {
    const csv =
      "usage_date,api_key_name,model,uncached_input_tokens,completion_tokens,request_count,amount_usd\n" +
      "2026-05-01,growth-key,claude-haiku-4-5,1000,500,3,0.01\n";
    const { rows, issues } = parseAnthropicConsole(csv);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(rows[0]).toMatchObject({ actor: "growth-key", model: "claude-haiku-4-5", input_tokens: 1000, output_tokens: 500, requests: 3, reported_cost_usd: 0.01 });
  });
});

describe("looksLikeAnthropicExport (format auto-detect)", () => {
  it("is true for an Anthropic export and false for canonical CSV", () => {
    expect(looksLikeAnthropicExport(read("sample-anthropic-export.csv"))).toBe(true);
    expect(looksLikeAnthropicExport(read("sample-canonical.csv"))).toBe(false);
  });
});
