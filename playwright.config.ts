import { defineConfig, devices } from "@playwright/test";

// Playwright is the standing behavioral / UI harness (D24): every batch that
// ships or changes UI gets a rung-3 check here.
//
// The webServer runs a PRODUCTION build (build then start), not the dev server.
// Under dev, Turbopack compiles each route on first hit; with parallel workers
// those cold compiles blew past the test timeout (B1). A production server
// serves the prebuilt pages instantly, so the rung-3 check is fast and reliable
// and mirrors what ships to Vercel. Set PW_DEV=1 to use the dev server locally.
const webServerCommand =
  process.env.PW_DEV === "1" ? "npm run dev" : "npm run build && npm run start";

export default defineConfig({
  testDir: "./e2e",
  // One worker: the local server is a single `next start` process, so parallel
  // workers contend on it and navigations stall (B1). The suite is small, so
  // serial is both reliable and fast (~20s). CI/Vercel scale differently.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
