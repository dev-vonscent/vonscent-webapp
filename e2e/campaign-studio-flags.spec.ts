import { test, expect } from "@playwright/test";

/**
 * Арга хэмжээний студи ба «Нүүрний баннер» (docs/campaigns/studio-ux.md) нь
 * `sale_events`, `hero_admin` тугийн ард. E2E демо горимд сангүй тул туг бүр
 * хаалттай (fail closed) — prod дээр нээгдээгүй үеийн төлөвтэй ижил: хуудсууд
 * шууд URL-ээр ч 404, нүүр хуудас кодын баннераар хэвийн гарна.
 */

for (const path of [
  "/admin/sale-events",
  "/admin/sale-events/new",
  "/admin/heroes",
  "/admin/heroes/new",
  "/admin/heroes/season/winter",
]) {
  test(`${path} — туг хаалттай бол 404`, async ({ page }) => {
    await page.goto(path);
    // Админы бүлгийн not-found (`(admin)/admin/not-found.tsx`). HTTP статус
    // 200: бүлгийн `loading.tsx`-ээс болж хариу stream-ээр эхэлдэг.
    await expect(
      page.getByRole("heading", { name: "Ийм бичлэг олдсонгүй" }),
    ).toBeVisible();
  });
}

test("туг хаалттай — нүүр хуудас кодын баннертайгаа, засварын горимгүй", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  // Студийн засварын атрибут дэлгүүрт хэзээ ч гарахгүй (S3).
  await expect(page.locator("[contenteditable]")).toHaveCount(0);
});
