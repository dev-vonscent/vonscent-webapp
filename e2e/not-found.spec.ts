import { test, expect } from "@playwright/test";

/**
 * Байхгүй хуудас жинхэнэ 404 статус буцаана (soft 404 биш).
 *
 * Хоёр шалтгаанаар 200 буцдаг байв:
 *  - `@footer/[...rest]` slot бүх замд таарч `/[...rest]` маршрут үүсгэдэг —
 *    `(shop)/[...rest]/page.tsx` одоо `notFound()` дуудна;
 *  - `loading.tsx`-ийн Suspense дотор шидэгдсэн `notFound()` толгой (200)
 *    явсны дараа гардаг — шалгалт нь boundary-ээс дээрх `layout.tsx`-д.
 *
 * DEMO горим: seed каталог, багц байхгүй.
 */

const NOT_FOUND = [
  "/zzz-nonexistent-path",
  "/a/b/c",
  "/catalog/zzz",
  "/products/zzz-no-such-product",
  "/collections/zzz-no-such-set",
  // Нуугдсан (CONTENT_PAGES_HIDDEN).
  "/about",
  "/blog",
  "/blog/unertei-us-songoh",
  // Туг хаалттай үеийн 404 (`lucky-wheel`, `request`) энд БИШ: e2e сервер
  // тугийг dev сангаас уншдаг тул асаалттай байж болно. `layout.test.ts`-д.
];

const OK = [
  "/",
  "/catalog",
  "/collections",
  "/products/dior-sauvage-edp",
  "/faq",
];

for (const path of NOT_FOUND) {
  test(`${path} → 404`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(404);
  });
}

for (const path of OK) {
  test(`${path} → 200`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
  });
}

test("404 хуудас дэлгүүрийн header, навигацтайгаа, footer-гүй", async ({
  page,
}) => {
  const res = await page.goto("/zzz-nonexistent-path");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Хуудас олдсонгүй" }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("#main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("байхгүй багц өөрийн «Багц олдсонгүй» хуудастай", async ({ page }) => {
  const res = await page.goto("/collections/zzz-no-such-set");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Багц олдсонгүй" }),
  ).toBeVisible();
});

test("footer зөвхөн нүүрэнд — soft navigation-оор гарахад үлдэхгүй", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await page.getByRole("link", { name: "Бүгдийг үзэх" }).first().click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  // Буцахад footer эргэж ирнэ.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
