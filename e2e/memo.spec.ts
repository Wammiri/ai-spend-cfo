import { test, expect } from "@playwright/test";

// B1 rung-3: the cached hero memo renders board-grade, shows dollar-backed
// figures, and visibly declines to invent causes (the honesty stance, C1 /
// credibility gate). It is labeled sample.
test.describe("CFO memo", () => {
  test("renders the cached board-ready memo", async ({ page }) => {
    await page.goto("/memo");

    await expect(
      page.getByRole("heading", { level: 1, name: /AI Spend Review/ }),
    ).toBeVisible();
    await expect(page.getByText(/May 2026/).first()).toBeVisible();
    await expect(page.getByText("Aperio Finance · AI Spend CFO").first()).toBeVisible();

    // honest labeling
    await expect(page.getByText("Sample data").first()).toBeVisible();

    // dollar-backed headline + flag figures
    await expect(page.getByText("$6,260.10").first()).toBeVisible();
    await expect(page.getByText("$2,145.20").first()).toBeVisible();

    // structure
    await expect(
      page.getByRole("heading", { name: /Recommended controls/ }),
    ).toBeVisible();
  });

  test("visibly declines to invent causes (needs review)", async ({ page }) => {
    await page.goto("/memo");
    await expect(page.getByText("On data sufficiency")).toBeVisible();
    await expect(page.getByText(/enforced in code, not left to the model/i)).toBeVisible();
  });
});
