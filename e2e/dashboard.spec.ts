import { test, expect } from "@playwright/test";

// B1 rung-3: the dashboard renders the Northstar numbers, charts draw, and the
// data is labeled sample everywhere (credibility gate).
test.describe("dashboard", () => {
  test("renders the control dashboard on the Northstar numbers", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: /AI Spend Control Dashboard/ }),
    ).toBeVisible();

    // honest labeling: synthetic data is marked sample
    await expect(page.getByText(/Synthetic demonstration data/)).toBeVisible();
    await expect(page.getByText("Northstar AI Labs").first()).toBeVisible();

    // computed KPIs (deterministic, server-rendered)
    await expect(page.getByText("$6,260.10").first()).toBeVisible(); // total spend
    await expect(page.getByText("$2,214.23").first()).toBeVisible(); // low-value spend

    // a top cost driver is named
    await expect(page.getByText("Model evaluation harness").first()).toBeVisible();
  });

  test("draws the charts", async ({ page }) => {
    await page.goto("/dashboard");
    // Recharts renders SVGs once laid out; several panels are charts
    await expect(page.locator("svg").first()).toBeVisible();
    const charts = await page.locator("svg").count();
    expect(charts).toBeGreaterThanOrEqual(3);

    // donut legend proves the by-tier composition path computed
    await expect(page.getByText("frontier").first()).toBeVisible();
    await expect(page.getByText("$4,958.22").first()).toBeVisible();
  });
});
