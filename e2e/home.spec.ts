import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Нүүр хуудасны сүүлийн засварууд (2026-09-13): устгасан блокууд, барааны
 * carousel-ын сум, хүйсийн chip, брэндийн гүйдэг мөр.
 *
 * Demo горимд ажиллана (playwright.config.ts Supabase-ыг хоослодог) тул
 * админаас удирддаг rail-ууд («Онцлох», «Багц уснууд») энд харагдахгүй —
 * эдгээр тест зөвхөн seed өгөгдлөөр буудаг хэсгүүдийг барина.
 */

test("hero-ийн доорх trust картууд ба «Бидний тухай» блок арилсан", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Каталог үзэх" })).toBeVisible();

  for (const gone of ["100% жинхэнэ", "Аюулгүй төлбөр", "Туршиж сонгох багц"]) {
    await expect(page.getByText(gone)).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "Үнэр бол хувийн илэрхийлэл" }),
  ).toHaveCount(0);
});

/** Эхний барааны rail ба доторх картын зурган холбоос. */
function firstCarousel(page: Page) {
  const carousel = page.locator("div.group\\/carousel").first();
  // Карт бүр хоёр холбоостой (зураг + нэр); эхнийх нь зураг.
  return { carousel, cards: carousel.locator('a[href^="/products/"]') };
}

/**
 * Гүйлгэх зайтай эхний rail. Demo каталог жижиг тул зарим rail нь дэлгэцэнд
 * бүтнээрээ багтаж, сумнууд нь идэвхгүй байдаг — тэднийг алгасна.
 */
async function scrollableCarousel(page: Page) {
  const rails = page.locator("div.group\\/carousel");
  for (let i = 0; i < (await rails.count()); i += 1) {
    const carousel = rails.nth(i);
    if (await carousel.getByRole("button", { name: "Дараах" }).isEnabled())
      return carousel;
  }
  throw new Error("Гүйлгэх боломжтой carousel олдсонгүй.");
}

test("carousel-ын сум картын зурагны голд суусан", async ({ page }) => {
  await page.goto("/");
  const { carousel, cards } = firstCarousel(page);
  await expect(cards.first()).toBeVisible();
  await carousel.hover();

  const next = carousel.getByRole("button", { name: "Дараах" });
  await expect(next).toBeVisible();

  const arrow = await next.boundingBox();
  const image = await cards.first().boundingBox();
  expect(arrow && image).toBeTruthy();
  const arrowCenter = arrow!.y + arrow!.height / 2;
  const imageCenter = image!.y + image!.height / 2;
  // Rail нь картын зурагнаас өндөр (доор нь брэнд/нэр/үнэ) тул rail-ын дунд
  // суусан сум зурагны голоос хэдэн арван px-ээр доогуур унана.
  expect(Math.abs(arrowCenter - imageCenter)).toBeLessThan(24);
});

test("carousel-ын сум нэг бараагаар гүйлгэнэ", async ({ page }) => {
  await page.goto("/");
  const carousel = await scrollableCarousel(page);
  const cards = carousel.locator('a[href^="/products/"]');
  await expect(cards.first()).toBeVisible();
  await carousel.hover();

  const before = await cards.first().boundingBox();
  await carousel.getByRole("button", { name: "Дараах" }).click();
  // Embla-гийн шилжилт дуустал.
  await page.waitForTimeout(800);
  const after = await cards.first().boundingBox();

  const moved = before!.x - after!.x;
  const cardWidth = before!.width;
  expect(moved).toBeGreaterThan(cardWidth * 0.5);
  // Бүлгээр (3-4 бараа) үсэрвэл энэ хязгаарыг давна.
  expect(moved).toBeLessThan(cardWidth * 1.7);
});

test("картан дээрх хүйсийн тэмдэг дэвсгэртэй chip", async ({ page }) => {
  await page.goto("/");
  const chip = page
    .locator("span", { hasText: /^(Эрэгтэй|Эмэгтэй|Unisex)$/ })
    .first();
  await expect(chip).toBeVisible();

  const background = await chip.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).not.toBe("transparent");
});

test("үнэрийн төрлийн дүрсүүд буудаг", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "Үнэрийн төрлөөр" }),
  });
  const icons = section.locator("img");
  await expect(icons.first()).toBeVisible();
  expect(await icons.count()).toBeGreaterThanOrEqual(4);
});

test.describe("брэндийн гүйдэг мөр", () => {
  /** Анимацийн төлөв (`running` / `paused`). */
  const playState = (track: Locator) =>
    track.evaluate((el) => getComputedStyle(el).animationPlayState);

  test("барихад зогсоод, гар салахад дахин урсана", async ({ page }) => {
    await page.goto("/");
    // Гүйж буй мөр өөрөө хэзээ ч «тогтвортой» болохгүй тул scroll/hover-ийг
    // хөдөлгөөнгүй гарчиг ба scroll контейнер дээр нь хийнэ.
    await page
      .getByRole("heading", { name: "Брэндээр" })
      .scrollIntoViewIfNeeded();
    const track = page.locator(".animate-marquee").first();
    const row = track.locator("xpath=..");
    await expect(row).toBeVisible();
    expect(await playState(track)).toBe("running");

    const box = (await row.boundingBox())!;
    const x = box.x + 60;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await expect.poll(() => playState(track)).toBe("paused");

    await page.mouse.down();
    expect(await playState(track)).toBe("paused");

    // Товчийг барьсан хэвээр мөрнөөс гарна: энд тавих нь брэндийн холбоос
    // дээрх товшилт болж каталог руу аваачна.
    await page.mouse.move(x, box.y - 150);
    await page.mouse.up();
    await expect.poll(() => playState(track)).toBe("running");
  });

  test("мөрийг гараар гүйлгэж болно", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Брэндээр" }).scrollIntoViewIfNeeded();
    const track = page.locator(".animate-marquee").first();
    const row = track.locator("xpath=..");
    await expect(row).toBeVisible();
    const overflowing = await row.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 10,
    );
    expect(overflowing).toBe(true);

    await row.evaluate((el) => {
      el.scrollLeft = 240;
    });
    expect(await row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });
});
