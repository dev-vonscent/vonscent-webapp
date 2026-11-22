import { test, expect } from "@playwright/test";

/**
 * Админ → Хямдрал. E2E нь prod-ын тугийн төлөвийг давтана: `sale_page`
 * нээлттэй, `named_sales` хаалттай (playwright.config.ts
 * `DEMO_FEATURE_FLAGS`). Демо горимд админ нэвтрэлтгүй нээлттэй (auth
 * backend байхгүй) бөгөөд хуудас seed каталогоор рендерлэгдэнэ.
 */

// Регресс: server хуудас `"use client"` файлаас `isOnSale()` дуудаж
// «Attempted to call isOnSale() from the server» гэж бүхэлдээ унадаг байв.
// Seed бараа бүр дээр дуудагдана — хоосон жагсаалт энэ алдааг нуудаг.
test("/admin/sales — нээгдэж, бараа, хямдралын төлөв харагдана", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/sales");
  await expect(
    page.getByRole("heading", { name: "Хямдрал", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Хямдрал тавих" }),
  ).toBeVisible();
  // Seed-ийн «sale» тагтай бараа хугацаагүй хямдралтай → «Хүчинтэй».
  await expect(page.getByText("Хүчинтэй").first()).toBeVisible();
  await expect(page.getByRole("checkbox").nth(1)).toBeVisible();
  await expect(page.getByText("Ийм бичлэг олдсонгүй")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Нэртэй хямдрал (16.2–16.6, 0188) хаалттай — шууд URL-ээр ч 404.
for (const path of ["/admin/sales/new", "/admin/sales/unnamed"]) {
  test(`${path} — named_sales хаалттай бол 404`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Ийм бичлэг олдсонгүй" }),
    ).toBeVisible();
  });
}

test("API — named_sales хаалттай бол 404", async ({ request }) => {
  const res = await request.post("/api/admin/sales/named", { data: {} });
  expect(res.status()).toBe(404);
});
