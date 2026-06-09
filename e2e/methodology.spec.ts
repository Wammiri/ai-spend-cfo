import { test, expect } from "@playwright/test";

// B2 rung-3: the methodology page is a credibility-checklist box (DISCOVERY
// section 9): it must show the cost formula, the versioned pricing table with
// the pending-confirmation label (the pricing human gate is not yet cleared),
// and state the honesty stance openly.
test.describe("methodology", () => {
  test("explains cost derivation, pricing, and the honesty stance", async ({ page }) => {
    await page.goto("/methodology");

    await expect(page.getByRole("heading", { level: 1, name: /How cost is calculated/ })).toBeVisible();

    // the derivation formula is shown
    await expect(page.getByText(/cost_usd = input_tokens/)).toBeVisible();

    // versioned pricing table: a known model and its price, plus the prior Opus row
    await expect(page.getByText("claude-opus-4-8").first()).toBeVisible();
    await expect(page.getByText("2025-06-01")).toBeVisible(); // prior effective row proves versioning

    // pricing values are not yet human-confirmed
    await expect(page.getByText(/pending confirmation/i)).toBeVisible();

    // the honesty stance is stated
    await expect(page.getByText(/deterministic code computes every number/i)).toBeVisible();
    await expect(page.getByText(/needs review/i).first()).toBeVisible();
  });

  test("offers the sample download and a path to import", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("link", { name: /Download sample CSV/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Try it with your data/ })).toBeVisible();
  });
});
