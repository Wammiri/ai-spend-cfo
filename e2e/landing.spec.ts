import { test, expect } from "@playwright/test";

// B1 rung-3: the landing communicates the product fast and leads with the memo
// (the hero), and its primary CTA actually reaches the memo.
test.describe("landing", () => {
  test("states the pitch and shows the memo as the hero", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("The FP&A layer for AI spend", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /Govern AI spend/ }),
    ).toBeVisible();

    // governance-not-monitoring positioning is present
    await expect(page.getByText(/Nobody gives finance a way to govern it/)).toBeVisible();

    // the memo preview (hero) shows real cached content
    await expect(page.getByText("AI Spend Review", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/needs review/i).first()).toBeVisible();
  });

  test("primary CTA opens the CFO memo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Read the CFO memo/ }).first().click();
    await expect(page).toHaveURL(/\/memo$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /AI Spend Review/ }),
    ).toBeVisible();
  });

  test("secondary CTA opens the dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Explore the dashboard/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /AI Spend Control Dashboard/ }),
    ).toBeVisible();
  });
});
