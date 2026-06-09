import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCanonicalCsv } from "./canonical-csv";

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(path.join(here, "../../public/sample-canonical.csv"), "utf8");

describe("parseCanonicalCsv", () => {
  it("parses the bundled canonical sample into typed rows", () => {
    const { rows, issues } = parseCanonicalCsv(sample, "synthetic");
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(rows).toHaveLength(8);
    const eng = rows[0];
    expect(eng).toMatchObject({ team: "Engineering", model: "claude-sonnet-4-6", input_tokens: 4_000_000, value_tag: "high", source: "synthetic" });
    // empty project cell becomes null (fires missing-owner downstream)
    expect(rows.filter((r) => r.project === null)).toHaveLength(2);
  });

  it("errors clearly when a required column is missing", () => {
    const { rows, issues } = parseCanonicalCsv("date,actor\n2026-05-01,x\n");
    expect(rows).toHaveLength(0);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toMatch(/Missing required column/);
  });

  it("skips a malformed row and reports it, keeping the rest", () => {
    const csv =
      "date,actor,provider,model,input_tokens,output_tokens,requests\n" +
      "2026-13-99,a,anthropic,claude-haiku-4-5,100,50,1\n" +
      "2026-05-02,b,anthropic,claude-haiku-4-5,abc,50,1\n" +
      "2026-05-03,c,anthropic,claude-haiku-4-5,100,50,1\n";
    const { rows, issues } = parseCanonicalCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].actor).toBe("c");
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(2);
  });

  it("accepts common header aliases and coerces enums", () => {
    const csv =
      "day,department,workflow,provider,model,prompt_tokens,completion_tokens,calls,value,approved,env,project\n" +
      "2026-05-01,Eng,Build,anthropic,claude-sonnet-4-6,1000,500,2,med,yes,production,Platform\n";
    const { rows, issues } = parseCanonicalCsv(csv);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(rows[0]).toMatchObject({ team: "Eng", value_tag: "medium", approval_status: "approved", environment: "prod" });
  });

  it("warns on an unrecognized value_tag and defaults it", () => {
    const csv =
      "date,actor,team,workflow,provider,model,input_tokens,output_tokens,requests,value_tag\n" +
      "2026-05-01,a,Eng,Build,anthropic,claude-haiku-4-5,100,50,1,sky-high\n";
    const { rows, issues } = parseCanonicalCsv(csv);
    expect(rows[0].value_tag).toBeUndefined(); // unset -> mapping defaults to medium later
    expect(issues.some((i) => i.severity === "warning" && /value_tag/.test(i.message))).toBe(true);
  });
});
