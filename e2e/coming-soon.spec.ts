import { test, expect, type Page } from "@playwright/test";

/**
 * «Тун удахгүй» (0125) дэлгүүрт: хуудас нээгдэнэ, үнэ харагдана, гэхдээ
 * сагслах ямар ч зам байхгүй; каталог, хайлтад гарахгүй. Demo seed-ийн
 * `SEED_COMING_SOON` (Baccarat Rouge 540) дээр.
 */
const SLUG = "mfk-baccarat-rouge-540";
const NAME = "Baccarat Rouge 540";

/** Нуугдмал (mobile buy bar нь md:hidden боловч DOM-д үргэлж байдаг) ч тоолно. */
function buyButtons(page: Page) {
  return {
    add: page.getByRole("button", {
      name: "Сагсанд нэмэх",
      includeHidden: true,
    }),
    buy: page.getByRole("button", { name: "Захиалах", includeHidden: true }),
  };
}

test.describe("«Тун удахгүй» бараа", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("хуудас нээгдэнэ, захиалах товч идэвхгүй, сагслах зам байхгүй", async ({
    page,
  }) => {
    // Хяналт: идэвхтэй бараан дээр ижил selector-ууд олддог.
    await page.goto("/products/dior-sauvage-edp");
    await expect(buyButtons(page).add.first()).toBeAttached();
    await expect(buyButtons(page).buy.first()).toBeAttached();

    await page.goto(`/products/${SLUG}`);
    await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
    await expect(page.getByText("Тун удахгүй ирнэ")).toBeVisible();
    await expect(page.getByText("10-р сарын сүүлээр")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Захиалга удахгүй нээгдэнэ" }),
    ).toBeDisabled();

    const { add, buy } = buyButtons(page);
    await expect(add).toHaveCount(0);
    await expect(buy).toHaveCount(0);
    await expect(page.getByText(/Нөөцөд бэлэн/)).toHaveCount(0);

    // Доош гүйлгэхэд ч buy bar гарч ирэхгүй.
    await page.mouse.wheel(0, 2000);
    await expect(add).toHaveCount(0);
  });

  test("нүүрний «Тун удахгүй» хэсэгт гарна", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator(`a[href="/products/${SLUG}"]`).first(),
    ).toBeAttached();
  });

  test("каталогт гарахгүй", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
    await expect(page.locator(`a[href="/products/${SLUG}"]`)).toHaveCount(0);

    await page.goto("/catalog?q=baccarat");
    await expect(page.locator(`a[href="/products/${SLUG}"]`)).toHaveCount(0);
  });

  test("хайлтад гарахгүй", async ({ request }) => {
    const res = await request.get("/api/search?q=baccarat");
    expect(res.ok()).toBe(true);
    const { results } = (await res.json()) as {
      results: { product: { href: string }[] };
    };
    expect(results.product).toEqual([]);

    // Хяналт: ижил зам идэвхтэй усыг олдог.
    const ok = await request.get("/api/search?q=sauvage");
    const okBody = (await ok.json()) as {
      results: { product: { href: string }[] };
    };
    expect(okBody.results.product.length).toBeGreaterThan(0);
  });
});
