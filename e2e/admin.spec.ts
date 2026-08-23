import { test, expect } from "@playwright/test";

// Demo mode leaves the admin area open (no auth backend), so the dashboard
// itself renders — this is a smoke test that the admin shell builds.
test("admin dashboard renders in demo mode", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Хяналтын самбар" }),
  ).toBeVisible();
});

test("admin products table renders", async ({ page }) => {
  await page.goto("/admin/products");
  await expect(page.locator("table").first()).toBeVisible();
});
