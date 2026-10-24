import { test, expect, type Page } from "@playwright/test";

/**
 * Storefront refresh (2026-10): the home hero is a static campaign image.
 * The 3D decant lineup (DecantPlayground / decant-vial-3d) stays in the
 * codebase but must not load on the home page — not on first paint, not
 * after interacting, not after scrolling. (Previous lazy-load rules:
 * docs/planning/hero-3d-performance.md.)
 */

/** `/hero/*.avif` posters, `/models/*` (glb + env maps), any canvas. */
function track3d(page: Page) {
  const urls: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/hero/") || u.pathname.startsWith("/models/"))
      urls.push(u.pathname);
  });
  return () => urls;
}

async function exercise(page: Page) {
  await page.goto("/");
  const hero = page.locator("section[aria-labelledby='home-hero-title']");
  await expect(hero).toBeVisible({ timeout: 60_000 });
  await hero.hover();
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(1500);
}

test("desktop: нүүрэнд 3D / poster ачаалагдахгүй", async ({ page }) => {
  const requests = track3d(page);
  await exercise(page);
  expect(requests()).toEqual([]);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-hero-3d]")).toHaveCount(0);
});

test.describe("хүрэлтийн дэлгэц", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("hero-г хүрсэн ч 3D ачаалагдахгүй", async ({ page }) => {
    const requests = track3d(page);
    await page.goto("/");
    const hero = page.locator("section[aria-labelledby='home-hero-title']");
    await expect(hero).toBeVisible({ timeout: 60_000 });
    await hero.locator("h1").tap();
    await page.waitForTimeout(1500);
    expect(requests()).toEqual([]);
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});
