import { test, expect } from "@playwright/test";

/**
 * Нүүр хуудас — storefront refresh (2026-10).
 *
 * Demo горимд ажиллана (playwright.config.ts Supabase-ыг хоослодог): багц,
 * админы хэсэг байхгүй тул hero нь evergreen хувилбар руу унаж, «Багц»
 * товчлол нуугдана — эдгээр тест seed өгөгдлөөр буудаг хэсгийг л барина.
 */

test("hero: ганц h1, үндсэн CTA, бүтэн дэлгэцийн биш", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("section[aria-labelledby='home-hero-title']");
  await expect(hero).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(hero.getByRole("link").first()).toHaveAttribute(
    "href",
    /^\/catalog/,
  );
  const box = (await hero.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.height).toBeLessThan(vh * 0.6);
});

test("хүйсний товчлол: зөвхөн утсан дээр, жагсаалт руу хөтөлнө", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Товч замууд" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(3);
  await expect(nav.getByRole("link", { name: "Эрэгтэй" })).toHaveAttribute(
    "href",
    "/catalog?gender=male",
  );

  // Desktop-д ижил сонголт каталог цэсэнд байгаа тул давтахгүй.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(nav).toBeHidden();
});

test("«Эрэлттэй»: 12 хүртэл нүдтэй carousel, «Бүгдийг үзэх» жагсаалт руу", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby='home-hot-title']");
  await expect(section).toBeVisible();
  await expect(
    section.getByRole("link", { name: /Бүгдийг үзэх/ }),
  ).toHaveAttribute("href", "/catalog?tags=hot");
  // Карт бүр зураг + нэр гэсэн хоёр холбоостой — давтагдаагүй href-ээр тоолно.
  const hrefs = await section
    .locator('a[href^="/products/"]')
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.length).toBeLessThanOrEqual(12);
  await expect(section.locator('a[href^="/products/"]').first()).toBeVisible();
});

test("хуучин том хэсгүүд нүүрнээс хасагдсан, каталогийн шүүлтүүр хэвээр", async ({
  page,
}) => {
  await page.goto("/");
  for (const gone of ["Хүйсээр", "Үнэрийн төрлөөр", "Улирлаар"]) {
    await expect(page.getByRole("heading", { name: gone })).toHaveCount(0);
  }
  // Брэндийн хана (автоматаар урсдаг) нүүрэнд үлдэнэ.
  await expect(page.getByRole("heading", { name: "Брэндээр" })).toBeVisible();
  // Мл нь variant — `?ml=` холбоос нүүрэнд гарахгүй.
  await expect(page.locator('a[href*="ml="]')).toHaveCount(0);

  const res = await page.goto("/catalog?gender=female&season=winter");
  expect(res?.status()).toBe(200);
});

test("desktop header: лого, хайлт, үндсэн ба туслах цэс", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: /нүүр хуудас/ })).toBeVisible();
  await expect(
    header.getByRole("button", { name: "Үнэртэн, брэнд хайх" }),
  ).toBeVisible();
  const menu = header.getByRole("navigation", { name: "Дэлгүүрийн цэс" });
  // «Каталог» нь dropdown: дарахад хүйс/төрөл/улирал/брэндийн панел нээгдэнэ,
  // Esc-ээр хаагдана.
  const catalog = menu.getByRole("button", { name: "Каталог" });
  await catalog.click();
  await expect(catalog).toHaveAttribute("aria-expanded", "true");
  await expect(
    menu.getByRole("link", { name: "Бүх үнэртэн үзэх" }),
  ).toHaveAttribute("href", "/catalog");
  await expect(menu.getByRole("link", { name: "Эмэгтэй" })).toHaveAttribute(
    "href",
    "/catalog?gender=female",
  );
  await page.keyboard.press("Escape");
  await expect(catalog).toHaveAttribute("aria-expanded", "false");
  await expect(catalog).toBeFocused();
  for (const [name, href] of [
    ["Бэлэн багц", "/collections"],
    ["Багц үүсгэх", "/collections/build"],
    ["Үнэрээ олох", "/quiz"],
  ]) {
    await expect(menu.getByRole("link", { name, exact: true })).toHaveAttribute(
      "href",
      href,
    );
  }
});

test("/quiz хуудас quiz-ийг эхний асуултаас нь эхлүүлнэ", async ({ page }) => {
  await page.goto("/quiz");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Үнэрээ олох",
  );
  await expect(
    page.getByRole("heading", { name: "Ямар төрлийн үнэртэн хайж байна вэ?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Эмэгтэй" })).toBeVisible();
});

test.describe("утас 390px", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("нэг compact header + хайлт, «Эрэлттэй» эхний дэлгэцэд", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: "Цэс" })).toBeVisible();
    // Утсан дээр хайлтын талбар биш ганц icon товч (`trigger="adaptive"`).
    await expect(header.getByRole("button", { name: "Хайх" })).toHaveCount(1);
    await expect(
      header.getByRole("button", { name: "Үнэртэн, брэнд хайх" }),
    ).toHaveCount(0);
    const hot = page.locator("#home-hot-title");
    await expect(hot).toBeVisible();
    const top = (await hot.boundingBox())!.y;
    expect(top).toBeLessThan(844 - 120);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("доод цэс ба drawer-оос үндсэн хуудсууд хүрэгдэнэ", async ({ page }) => {
    await page.goto("/");
    // Каталог / Багц нь доод цэсэнд — drawer тэдгээрийг давтахгүй
    // (mobile-menu.tsx `MENU_HIDDEN`); «Үнэрээ олох» нүүрний IntentCards-д.
    const bottom = page.getByRole("navigation", { name: "Үндсэн цэс" });
    for (const href of ["/catalog", "/collections"]) {
      await expect(bottom.locator(`a[href="${href}"]`)).toBeVisible();
    }
    await expect(page.locator('main a[href="/quiz"]').first()).toBeVisible();

    await page.getByRole("button", { name: "Цэс" }).tap();
    const drawer = page.getByRole("dialog");
    for (const href of ["/collections/build", "/faq", "/contact"]) {
      await expect(drawer.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });
});
