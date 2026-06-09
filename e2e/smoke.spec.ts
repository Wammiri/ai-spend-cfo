import { test, expect } from "@playwright/test";

// B0.5 smoke: proves the app boots and the Tailwind v4 stack is actually wired,
// not just present. The color assertion is the real proof: text-accent compiles
// only if Tailwind processed the utilities AND resolved the custom @theme token
// --color-accent (#0f766e => rgb(15, 118, 110)) from app/globals.css.
test("landing page renders with Tailwind applied", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/AI Spend CFO/);

  const heading = page.getByRole("heading", { name: "AI Spend CFO", level: 1 });
  await expect(heading).toBeVisible();

  const accentLine = page.getByText("Scaffold in progress");
  await expect(accentLine).toHaveCSS("color", "rgb(15, 118, 110)");
});
