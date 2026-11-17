import { test, expect } from "@playwright/test";

/**
 * Нэртэй хямдрал (task 16.2–16.6, 0188) нь `sale_page` + `named_sales`
 * тугийн ард. E2E демо горимд сангүй тул туг бүр хаалттай (fail closed) —
 * prod дээр нээгдээгүй үеийн төлөв: хуудсууд шууд URL-ээр ч 404.
 */
for (const path of [
  "/admin/sales",
  "/admin/sales/new",
  "/admin/sales/unnamed",
]) {
  test(`${path} — туг хаалттай бол 404`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Ийм бичлэг олдсонгүй" }),
    ).toBeVisible();
  });
}

test("API — туг хаалттай бол 404", async ({ request }) => {
  const res = await request.post("/api/admin/sales/named", { data: {} });
  expect(res.status()).toBe(404);
});
