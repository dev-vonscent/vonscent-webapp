import { test, expect, type Page } from "@playwright/test";

/** Pick an option from a Radix select opened by clicking `trigger`. */
async function pickOption(page: Page, triggerIndex: number, option?: string) {
  await page.getByRole("combobox").nth(triggerIndex).click();
  const options = page.getByRole("option");
  if (option) await options.filter({ hasText: option }).first().click();
  else await options.first().click();
}

test("guest places a demo order end to end", async ({ page }) => {
  await page.goto("/products/dior-sauvage-edp");
  await page.getByRole("button", { name: /Сагсанд нэмэх/ }).first().click();

  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Захиалга өгөх" }),
  ).toBeVisible();

  await page.getByPlaceholder("Таны нэр").fill("Тест Хэрэглэгч");
  const phone = page.getByPlaceholder("99112233");
  await phone.fill("99118822");
  await expect(phone).toHaveValue("99118822");

  // Address cascade: city → district → khoroo (UB only).
  await pickOption(page, 0, "Улаанбаатар");
  await pickOption(page, 1);
  await pickOption(page, 2);
  await page.getByPlaceholder("Байр, орц, тоот").fill("45-р байр 12 тоот");

  // Payment: bank transfer avoids the QPay invoice branch.
  await page.getByRole("radio").last().click();

  await page
    .getByRole("button", { name: /Захиалга баталгаажуулах/ })
    .click();

  // A guest gets a "no loyalty points" interstitial before the order posts.
  await page.getByRole("button", { name: "Зочноор үргэлжлүүлэх" }).click();

  await expect(page).toHaveURL(/\/order\/success/, { timeout: 15_000 });
});
