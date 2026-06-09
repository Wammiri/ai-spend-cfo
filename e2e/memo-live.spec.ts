import { test, expect } from "@playwright/test";

// B4 rung-3 (D24): the live memo path on the upload page. The quantified risk
// view (with model-tier repricing, D12) renders from the parsed sample, and the
// Generate memo control posts to /api/memo and renders the returned memo with the
// control-C2 verification badge. The /api/memo call is mocked so the UI flow is
// deterministic in CI; the real end-to-end against Claude is the rung-4 check
// (recorded in SESSION_LOG), gated on the API key.

const cannedMemo = {
  meta: {
    title: "AI Spend Review",
    period_label: "May 2026",
    org: "Your usage",
    prepared_by: "AI Spend CFO, by Aperio Finance",
    source_label: "Provider export",
    cached: false,
    generated_note: "Generated live for the test.",
    scope_note: "",
  },
  headline: [{ label: "Total AI spend", value_usd: 355.2, sub: "May 2026, all providers" }],
  sections: [
    {
      id: "executive-summary",
      number: 1,
      heading: "Executive summary",
      blocks: [{ type: "paragraph", text: "A live generated summary for the test." }],
    },
  ],
  needs_review: [{ label: "None", reason: "All drivers cleared the data floor." }],
  needs_review_note: "Enforced in code, not left to the model.",
  figures: { total_spend: 355.2 },
};

test.describe("live CFO memo (upload path)", () => {
  test("quantifies waste and risk from the parsed sample", async ({ page }) => {
    await page.goto("/upload");
    await page.getByRole("button", { name: "Anthropic Console export" }).click();

    // The B4 risk view renders with at least the missing-owner exposure ($12).
    await expect(page.getByRole("heading", { name: "Waste and risk" })).toBeVisible();
    await expect(page.getByText("Missing owner").first()).toBeVisible();
  });

  test("generates and renders a validated live memo", async ({ page }) => {
    await page.route("**/api/memo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ memo: cannedMemo, validation: { ok: true, flagged: [] } }),
      });
    });

    await page.goto("/upload");
    await page.getByRole("button", { name: "Anthropic Console export" }).click();

    await page.getByRole("button", { name: "Generate memo" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: /AI Spend Review/ }),
    ).toBeVisible();
    await expect(page.getByText("All figures verified")).toBeVisible();
    await expect(page.getByText("A live generated summary for the test.")).toBeVisible();
  });
});
