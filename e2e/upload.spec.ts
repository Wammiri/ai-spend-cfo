import { test, expect } from "@playwright/test";

// B2 rung-3: the live ingestion path end to end on a bundled sample. Loading the
// Anthropic Console sample must parse, re-derive cost, reconcile against the
// reported cost (flagging the divergent model), resolve owners through the
// mapping (surfacing the unmapped key), and recompute live when the mapping is
// edited. This is the "real provider export parses end to end" credibility box,
// proven on the sample so it runs without anyone's private data.
test.describe("upload and normalize", () => {
  test("parses the Anthropic sample, reconciles, and maps owners", async ({ page }) => {
    await page.goto("/upload");

    await page.getByRole("button", { name: "Anthropic Console export" }).click();

    // normalized totals (re-derived from tokens + pricing table)
    await expect(page.getByText("$355.20").first()).toBeVisible();

    // reconciliation flagged the one divergent model (D10)
    await expect(page.getByText(/1 flagged/)).toBeVisible();
    await expect(page.getByText("claude-opus-4-8").first()).toBeVisible();
    await expect(page.getByText("Review").first()).toBeVisible();

    // the unmapped key is surfaced (D14): missing-owner = its $12.00
    const missingOwner = page.locator("div.relative", { hasText: "Missing owner" });
    await expect(missingOwner.locator("p.tnum").first()).toHaveText("$12.00");
    await expect(page.getByText("test-key-7f3a2b")).toBeVisible();
    await expect(page.getByText("Unassigned").first()).toBeVisible();
  });

  test("editing the mapping recomputes the dashboard live", async ({ page }) => {
    await page.goto("/upload");
    await page.getByRole("button", { name: "Anthropic Console export" }).click();

    const missingOwner = page.locator("div.relative", { hasText: "Missing owner" });
    await expect(missingOwner.locator("p.tnum").first()).toHaveText("$12.00");

    // assign the orphaned key a project: the missing-owner flag must clear
    await page.getByLabel("Project for test-key-7f3a2b").fill("Platform");
    await expect(missingOwner.locator("p.tnum").first()).toHaveText("$0.00");
  });

  test("a canonical CSV needs no owner mapping", async ({ page }) => {
    await page.goto("/upload");
    await page.getByRole("button", { name: "Canonical CSV" }).click();

    await expect(page.getByText("$258.45").first()).toBeVisible(); // re-derived total
    await expect(page.getByText(/no owner mapping is needed/i)).toBeVisible();
    await expect(page.getByText(/nothing to reconcile/i)).toBeVisible(); // no reported cost column
  });
});
