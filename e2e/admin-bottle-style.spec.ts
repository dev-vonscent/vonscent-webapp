import { test, expect } from "@playwright/test";

/**
 * Админ → Шинэ бараа: галерейд нэмэх савны зургийг 3 сонголтоос гараар
 * сонгоно (хүйсээс автоматаар сонгодоггүй). Demo горим админы хэсгийг
 * нээлттэй үлдээдэг (admin.spec.ts).
 */
test("шинэ бараанд савны зургийг сонгоно", async ({ page }) => {
  await page.goto("/admin/products/new");
  await expect(
    page.getByRole("heading", { name: "Савны зураг" }),
  ).toBeVisible();

  const group = page.getByRole("radiogroup", { name: "Савны зураг" });
  const radio = (name: string) => group.getByRole("radio", { name });

  // Анхдагчаар нэмэхгүй.
  await expect(radio("Нэмэхгүй")).toHaveAttribute("aria-checked", "true");

  await radio("Мөнгөлөг сав").click();
  await expect(radio("Мөнгөлөг сав")).toHaveAttribute("aria-checked", "true");
  await expect(radio("Нэмэхгүй")).toHaveAttribute("aria-checked", "false");

  // Урьдчилан харах зураг public/bottles-оос ачаалагдана.
  const img = radio("Мөнгөлөг сав").locator("img");
  await expect(img).toHaveJSProperty("complete", true);
  expect(
    await img.evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThan(0);
});

test("хүйс солиход савны сонголт өөрчлөгдөхгүй", async ({ page }) => {
  await page.goto("/admin/products/new");
  const group = page.getByRole("radiogroup", { name: "Савны зураг" });
  await group.getByRole("radio", { name: "Хар сав" }).click();

  await page.getByRole("combobox").filter({ hasText: "Unisex" }).click();
  await page.getByRole("option", { name: "Эмэгтэй" }).click();

  await expect(group.getByRole("radio", { name: "Хар сав" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
