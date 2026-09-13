import { test, expect } from "@playwright/test";

/**
 * Мэдэгдэл: самбарын хамгийн дээд карт → «Бүгдийг харах» → тусдаа хуудас →
 * буцах холбоос. Demo горимд өгөгдлийн сан байхгүй тул жагсаалт хоосон, харин
 * карт нь байрандаа байх ёстой — түүхийн хуудас руу орох цорын ганц хаалга.
 */
test("самбараас мэдэгдлийн хуудас руу орж, буцаж чадна", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: /Шинэ мэдэгдэл/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Бүгдийг харах/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/notifications$/);
  await expect(page.getByRole("heading", { name: "Мэдэгдэл" })).toBeVisible();

  await page
    .locator("#main")
    .getByRole("link", { name: "Хяналтын самбар" })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Хяналтын самбар" }),
  ).toBeVisible();
});
