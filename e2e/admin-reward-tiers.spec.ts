import { test, expect } from "@playwright/test";

/**
 * Урамшуулал → Автомат: шатлалын drawer. Бодит хөтөч дээр шалгана — confirm
 * давхар асуугддаг алдаа нь Radix-ийн focus/outside event-ээс үүсдэг тул
 * jsdom-д давтагддаггүй.
 */
test.use({ viewport: { width: 390, height: 844 } });

const question = /Өөрчлөлтөө хадгалахгүй гарах уу/;

test.beforeEach(async ({ page }) => {
  await page.goto("/admin/promotions?tab=auto");
  await page.getByRole("button", { name: /Шатлал тохируулах/ }).click();
  await page.getByRole("button", { name: /Шатлал нэмэх/ }).click();
});

test("«Болих» → нэг л удаа асууж, зөвшөөрвөл хаагдана", async ({ page }) => {
  await page.screenshot({ path: "test-results/reward-tier-drawer-mobile.png" });
  await page.getByRole("button", { name: "Болих", exact: true }).click();
  await expect(page.getByText(question)).toHaveCount(1);
  await page.getByRole("button", { name: "Хадгалахгүй гарах" }).click();
  await expect(page.getByRole("button", { name: /Шатлал нэмэх/ })).toHaveCount(
    0,
  );
  await page.waitForTimeout(500);
  await expect(page.getByText(question)).toHaveCount(0);
});

test("Escape → нэг л удаа асууна", async ({ page }) => {
  await page.keyboard.press("Escape");
  await expect(page.getByText(question)).toHaveCount(1);
  await page.getByRole("button", { name: "Хадгалахгүй гарах" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(question)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Шатлал нэмэх/ })).toHaveCount(
    0,
  );
});

test("гадна дарах (desktop) → нэг л удаа асууна", async ({ page }) => {
  // Утсан дээр drawer бүтэн өргөнтэй — гадна нь зөвхөн том дэлгэцэд.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.mouse.click(20, 400);
  await expect(page.getByText(question)).toHaveCount(1);
  await page.getByRole("button", { name: "Хадгалахгүй гарах" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(question)).toHaveCount(0);
});

test("асуултаас буцвал drawer засвартайгаа үлдэнэ", async ({ page }) => {
  await page.getByRole("button", { name: "Болих", exact: true }).click();
  const dialog = page
    .getByRole("alertdialog")
    .or(page.getByRole("dialog").filter({ hasText: question }));
  await dialog.getByRole("button", { name: "Болих", exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(question)).toHaveCount(0);
  await expect(page.getByText(/^Шатлал \d/)).not.toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Шатлал нэмэх/ }),
  ).toBeVisible();
});
