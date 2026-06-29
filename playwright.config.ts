import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a DEPLOYED site (the dev Vercel app by default),
// not a locally-spun server — so there is intentionally no `webServer` block.
// Override the target with E2E_BASE_URL (e.g. a preview URL or production).
//
// The smoke specs (e2e/auth-navigation.spec.ts) run without credentials and
// exercise the middleware guard + Back-button handling on public routes. The
// authenticated repro (e2e/backbutton-logout.spec.ts) self-skips unless
// E2E_USER / E2E_PASS are set.
export default defineConfig({
  testDir: "e2e",
  // Fail the build on a `test.only` left in source.
  forbidOnly: !!process.env.CI,
  // Live-site flakiness (cold starts, network) is real; retry on CI only.
  retries: process.env.CI ? 2 : 0,
  // Keep the run deterministic; no need to parallelize a tiny suite.
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://dev-fa-web-app.vercel.app",
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
