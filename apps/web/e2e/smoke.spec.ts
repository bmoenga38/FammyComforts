import { test, expect } from "@playwright/test";

test("root redirects to the guest workspace and the shell renders", async ({
  page,
}) => {
  await page.goto("/");

  // `/` redirects to the default workspace (Story 1.7).
  await expect(page).toHaveURL(/\/guest$/);

  // Top-bar heading shows the active workspace title.
  await expect(
    page.getByRole("heading", { level: 1, name: "Guest Booking" }),
  ).toBeVisible();

  // The sidebar exposes the other workspaces.
  await expect(page.getByRole("link", { name: "Front Desk" })).toBeVisible();
});
