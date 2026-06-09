import { test, expect } from "@playwright/test";

// Stack-applied smoke: proves the app boots and Tailwind v4 actually compiled,
// not just that it is installed. The color assertion only passes if Tailwind
// processed the utilities AND resolved the custom @theme token --color-accent
// (#0e5a4e => rgb(14, 90, 78)) from app/globals.css.
test("landing boots with the design system applied", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/AI Spend CFO/);

  const heading = page.getByRole("heading", {
    name: /Govern AI spend the way finance governs everything else/,
    level: 1,
  });
  await expect(heading).toBeVisible();

  // nav brand uses the custom accent token
  const brand = page.getByText("Aperio", { exact: true });
  await expect(brand).toHaveCSS("color", "rgb(14, 90, 78)");
});
