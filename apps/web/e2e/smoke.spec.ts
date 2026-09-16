import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the production build (`next start`, see playwright.config.ts).
 *
 * Deliberately backend-free. CI has no Convex deployment of its own — `ci.yml`
 * sets `NEXT_PUBLIC_CONVEX_URL` to a placeholder that does not resolve, so the
 * client constructs, the app boots, and every `useQuery` simply stays
 * `undefined` forever. That is on purpose: these tests answer "does the shipped
 * bundle boot, render and hydrate?", not "is the data right". Anything that
 * needs data belongs in a test that provisions its own deployment.
 *
 * That rules out asserting on `/`: the root resolver waits for
 * `useConvexAuth()` to settle before redirecting, which never happens without a
 * reachable backend, so `/` legitimately spins. `/signin` is the deepest route
 * that renders fully from client state alone.
 *
 * (Superseded spec: this file used to assert `/` → `/guest` with an `h1` of
 * "Guest Booking". Both facts stopped being true in Epic 2 — signed-out
 * visitors go to `/book`, and no workspace carries that title — so it had been
 * failing on `main` for months.)
 */

test("the sign-in gate renders from the production bundle", async ({ page }) => {
  await page.goto("/signin");

  await expect(page.getByRole("heading", { level: 1, name: "Fammy Comforts" })).toBeVisible();

  // Both sign-in methods are offered; the phone tab is the default.
  const phoneTab = page.getByRole("tab", { name: "Phone" });
  const adminTab = page.getByRole("tab", { name: "Admin" });
  await expect(phoneTab).toHaveAttribute("aria-selected", "true");
  await expect(adminTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByPlaceholder("+254 7XX XXX XXX")).toBeVisible();
});

test("the sign-in page hydrates — switching tabs swaps the form", async ({ page }) => {
  await page.goto("/signin");

  // Tab switching is pure client state. If the bundle failed to hydrate the
  // server-rendered HTML would still show the phone field and this would fail,
  // which is exactly the regression worth catching.
  await page.getByRole("tab", { name: "Admin" }).click();

  await expect(page.getByPlaceholder("admin@fammycomforts.co.ke")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to dashboard" })).toBeVisible();
  await expect(page.getByPlaceholder("+254 7XX XXX XXX")).toBeHidden();
});

test("/login forwards to the canonical sign-in route", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveURL(/\/signin$/);
});

test("the offline fallback document renders", async ({ page }) => {
  // Precached by Serwist (`additionalPrecacheEntries` in next.config.ts) and
  // served when a navigation fails, so it must render with no JS data at all.
  await page.goto("/offline");

  await expect(page).toHaveTitle(/Offline/);
  await expect(page.getByRole("heading", { level: 1, name: /You.re offline/ })).toBeVisible();
});
