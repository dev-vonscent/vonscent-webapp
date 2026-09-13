import { test, expect } from "@playwright/test";

/**
 * Танилцуулга (`/about`) ба Блог (`/blog`) нуугдсан (CONTENT_PAGES_HIDDEN).
 * Холбоос нь цэс/footer-оос хассан бөгөөд шууд URL-ээр ч орохгүй.
 */

for (const path of ["/about", "/blog", "/blog/unertei-us-songoh"]) {
  test(`${path} — нуугдсан хуудас 404 харуулна`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Хуудас олдсонгүй" }),
    ).toBeVisible();
    // Хуудасны өөрийнх нь агуулга гарахгүй.
    await expect(page.getByRole("heading", { name: "Блог" })).toHaveCount(0);
  });
}

test("нүүр хуудсанд Танилцуулга/Блог холбоос үлдээгүй", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href="/about"]')).toHaveCount(0);
  await expect(page.locator('a[href="/blog"]')).toHaveCount(0);
  await expect(page.locator('footer a[href^="/blog"]')).toHaveCount(0);
});

test("sitemap-д нуугдсан хуудсууд байхгүй", async ({ page }) => {
  const res = await page.request.get("/sitemap.xml");
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  expect(xml).toContain("/catalog");
  expect(xml).not.toContain("/about");
  expect(xml).not.toContain("/blog");
});
