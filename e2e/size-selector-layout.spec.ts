import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Хэмжээ сонгогчийн layout тогтвортой байдал (PR #291).
 *
 * `pnpm test:e2e` DEMO (seed) горимд ажилладаг: seed-д дуусах хугацаатай
 * хямдрал, бэлэн багц байхгүй — seed-ийн хямдралтай ус (By the Fireplace)
 * дээр шалгана, багцын тест алгасагдана. Dev сан дээр бодит өгөгдлөөр
 * (Hero edp, NIGHT OUT — тоолуур, event-тэй):
 *   E2E_DEV=1 npx playwright test e2e/size-selector-layout.spec.ts \
 *     --config <baseURL=http://localhost:3000, webServer-гүй>
 */
const DEV = process.env.E2E_DEV === "1";
const PRODUCT = DEV
  ? {
      path: "/products/burberry-hero-edp",
      sizes: ["2ml", "5ml", "10ml", "20ml"],
    }
  : {
      path: "/products/maison-margiela-by-the-fireplace",
      sizes: ["5ml", "10ml", "20ml"],
    };
const BUNDLE = {
  path: "/collections/night-out-dd73e",
  sizes: ["2ml", "5ml", "10ml", "20ml"],
};
const QUICK = DEV
  ? { search: "hero", sizes: ["2ml", "5ml", "20ml"] }
  : { search: "fireplace", sizes: ["5ml", "10ml", "20ml"] };

const MOBILE = { width: 375, height: 900 };
const y = async (l: Locator) => (await l.boundingBox())!.y;

async function pickAll(
  group: Locator,
  sizes: string[],
  measure: () => Promise<number[]>,
) {
  const seen: number[][] = [];
  for (const ml of sizes) {
    const radio = group.getByRole("radio", { name: new RegExp(`^${ml}`) });
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true");
    seen.push(await measure());
  }
  for (const s of seen) expect(s).toEqual(seen[0]);
}

function sizeGroup(scope: Page | Locator) {
  return scope.getByRole("radiogroup", { name: "Хэмжээ сонгох" });
}

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["375px", MOBILE],
] as const) {
  test(`size selector does not move when the sale countdown appears (${name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(PRODUCT.path);
    const group = sizeGroup(page);
    const [a, b] = PRODUCT.sizes;
    await pickAll(group, [a, b, a], async () => [await y(group)]);
  });
}

test("375px: «Сагсанд нэмэх» does not move across all sizes (product)", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto(PRODUCT.path);
  const cart = page.getByRole("button", { name: /Сагсанд нэмэх/ }).first();
  await pickAll(sizeGroup(page), PRODUCT.sizes, async () => [await y(cart)]);
});

test("375px: «Сагсанд нэмэх» does not move across all sizes (bundle)", async ({
  page,
}) => {
  test.skip(!DEV, "DEMO горимд бэлэн багц байхгүй");
  await page.setViewportSize(MOBILE);
  await page.goto(BUNDLE.path);
  const cart = page.getByRole("button", { name: /Сагсанд нэмэх/ }).first();
  await pickAll(sizeGroup(page), BUNDLE.sizes, async () => [await y(cart)]);
});

test("375px quick-add: selector and «Сагсанд нэмэх» do not move", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto(`/catalog?q=${QUICK.search}`);
  await page.getByRole("button", { name: "Сагсанд нэмэх" }).first().click();
  const dialog = page.getByRole("dialog");
  const group = sizeGroup(dialog);
  await expect(group).toBeVisible();
  const cart = dialog.getByRole("button", { name: /Сагсанд нэмэх/ });
  await pickAll(group, QUICK.sizes, async () => [
    await y(group),
    await y(cart),
  ]);
});

/** Тэмдэг «Хэмжээ сонгох» гарчигтай огтлолцохгүй (4). */
async function expectNoMarkerOverlap(scope: Page | Locator) {
  const group = sizeGroup(scope);
  const markerL = group.locator("[data-marker]").first();
  await expect(markerL).toBeVisible();
  // Гарчиг нь radiogroup-ийн нэр (aria-labelledby).
  const headingId = await group.getAttribute("aria-labelledby");
  const headingL = scope.locator(`[id="${headingId}"]`);
  await expect(headingL).toBeVisible();
  const heading = await headingL.boundingBox();
  const marker = await markerL.boundingBox();
  expect(heading && marker).toBeTruthy();
  const h = heading!;
  const m = marker!;
  const overlaps =
    m.x < h.x + h.width &&
    h.x < m.x + m.width &&
    m.y < h.y + h.height &&
    h.y < m.y + m.height;
  expect(overlaps).toBe(false);
}

for (const width of [320, 375, 1280]) {
  test(`sale marker does not overlap the heading (product, ${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(PRODUCT.path);
    await expectNoMarkerOverlap(page);
  });
}

test("sale marker does not overlap the heading (quick-add, 320px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/catalog?q=${QUICK.search}`);
  await page.getByRole("button", { name: "Сагсанд нэмэх" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(sizeGroup(dialog)).toBeVisible();
  await expectNoMarkerOverlap(dialog);
});

test("sale marker does not overlap the heading (bundle, 320px)", async ({
  page,
}) => {
  test.skip(!DEV, "DEMO горимд бэлэн багц байхгүй");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(BUNDLE.path);
  await expectNoMarkerOverlap(page);
});
