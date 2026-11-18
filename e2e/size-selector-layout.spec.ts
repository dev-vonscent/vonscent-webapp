import { expect, test } from "@playwright/test";

/**
 * Хэмжээ солиход (хямдралгүй ↔ хямдралтай) үнийн мөрийн тоолуур pill гарч
 * ирэх/алга болох ч хэмжээ сонгогч (ба доорх товчууд) хөдлөхгүй.
 *
 * `pnpm test:e2e` DEMO (seed) горимд ажилладаг — seed-д дуусах хугацаатай
 * хямдрал байхгүй тул pill гарахгүй, зөвхөн хямдралтай ↔ хямдралгүй үнийн
 * мөрийн өндрийг шалгана. Dev сан дээр бодит тоолууртай шалгах:
 *   E2E_SIZE_SLUG=burberry-hero-edp E2E_SIZE_FROM=2ml E2E_SIZE_TO=5ml \
 *     npx playwright test e2e/size-selector-layout.spec.ts --config <baseURL=dev>
 */
const SLUG = process.env.E2E_SIZE_SLUG ?? "maison-margiela-by-the-fireplace";
const FROM = process.env.E2E_SIZE_FROM ?? "5ml";
const TO = process.env.E2E_SIZE_TO ?? "10ml";

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 900 }],
  ["375px", { width: 375, height: 900 }],
] as const) {
  test(`size selector does not move when the sale countdown appears (${name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/products/${SLUG}`);
    const group = page.getByRole("radiogroup", { name: "Хэмжээ сонгох" });
    const pick = async (ml: string) => {
      const radio = group.getByRole("radio", { name: new RegExp(`^${ml}`) });
      await radio.click();
      await expect(radio).toHaveAttribute("aria-checked", "true");
      return (await group.boundingBox())!.y;
    };
    const y1 = await pick(FROM);
    const y2 = await pick(TO);
    const y3 = await pick(FROM);
    expect(y2).toBe(y1);
    expect(y3).toBe(y1);
  });
}
