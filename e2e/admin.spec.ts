import { test, expect } from "@playwright/test";

// Demo mode leaves the admin area open (no auth backend), so the dashboard
// itself renders — this is a smoke test that the admin shell builds.
test("admin dashboard renders in demo mode", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Хяналтын самбар" }),
  ).toBeVisible();
});

// Demo mode has no database, so the catalogue is empty. The products page no
// longer renders an empty table shell for that — an empty catalogue and a
// filter that matched nothing are two different nothings, and each gets its
// own state with the way out. This still smoke-tests that the page builds and
// renders server-side.
test("admin products page renders", async ({ page }) => {
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: "Бараа" })).toBeVisible();
  await expect(page.getByText("Каталог хоосон байна")).toBeVisible();
});
