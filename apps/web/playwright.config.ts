import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config (Story 1.9, AR8). Specs live in `./e2e` (outside the
 * Vitest `src/**` glob, so the two runners never collide). The webServer serves
 * a prior production build via `next start`; build first (`pnpm --filter
 * @fammycomforts/web build`) — CI does this before `test:e2e`. Browsers are
 * installed in CI via `playwright install --with-deps chromium`.
 */
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
