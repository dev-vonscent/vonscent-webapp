import { test, expect } from "@playwright/test";

test("home page renders the storefront", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
});

test("catalog search finds Latin names from Cyrillic queries", async ({
  page,
}) => {
  await page.goto("/catalog?q=диор");
  const cards = page.locator('a[href^="/products/"]');
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText("Sauvage").first()).toBeVisible();
});

test("product can be added to the cart and reaches checkout", async ({
  page,
}) => {
  await page.goto("/products/dior-sauvage-edp");
  await expect(page.getByText("Sauvage").first()).toBeVisible();

  // .first() — the related-products carousel has quick-add buttons too.
  await page
    .getByRole("button", { name: /Сагсанд нэмэх/ })
    .first()
    .click();

  // The cart badge appears on the header trigger — its count is part of the
  // accessible name («Сагс, 1»), so the visible number matches the label.
  const cartButton = page.getByRole("button", { name: /^Сагс, \d+$/ });
  await expect(cartButton.first()).toBeVisible();
  await cartButton.first().click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Sauvage").first()).toBeVisible();
  await sheet.getByRole("link", { name: "Захиалах" }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await expect(
    page.getByRole("heading", { name: "Захиалга өгөх" }),
  ).toBeVisible();
});

test("FAQ fuzzy search filters questions", async ({ page }) => {
  await page.goto("/faq");
  const input = page.getByPlaceholder("Асуултаар хайх…");
  await expect(input).toBeVisible();
  await input.fill("байхгүйзүйлбайхгүйээ");
  await expect(page.getByText(/илэрц олдсонгүй/)).toBeVisible();
});

test("product size selector: price follows the size, sold-out size is selectable but not buyable", async ({
  page,
}) => {
  // Seed: 8ml үлдэгдэл → 5ml зарагдана, 10/20ml дууссан.
  await page.goto("/products/acqua-di-parma-colonia");
  const group = page.getByRole("radiogroup", { name: "Хэмжээ сонгох" });
  const price = page.getByTestId("size-price");
  const hint = page.getByTestId("size-hint");

  // Анхдагч: зарагдах хамгийн эхний хэмжээ; карт дээр үнэгүй, цацалттай.
  const five = group.getByRole("radio", { name: "5ml" });
  await expect(five).toHaveAttribute("aria-checked", "true");
  await expect(five).toContainText("≈ 75 цацалт");
  await expect(five).not.toContainText("₮");
  await expect(price).toContainText("40,800₮");
  await expect(hint).toHaveText("Халаасанд багтахуйц");

  // Дууссан хэмжээ сонгогдоно — үнэ нь дээр, товч идэвхгүй «Дууссан».
  const ten = group.getByRole("radio", { name: "10ml — Дууссан" });
  await ten.click();
  await expect(ten).toHaveAttribute("aria-checked", "true");
  await expect(price).toContainText("68,900₮");
  await expect(hint).toHaveText("Авч явахад тохиромжтой");
  await expect(page.getByRole("button", { name: "Дууссан" })).toBeDisabled();
  // .first() — хуудсан доторх товч (доод зурвас, carousel-ийн quick-add бусад).
  await expect(
    page.getByRole("button", { name: /Сагсанд нэмэх/ }).first(),
  ).toBeDisabled();

  // Гараар: сумаар буцаж 5ml → худалдан авах товч идэвхжинэ.
  await ten.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(five).toHaveAttribute("aria-checked", "true");
  await expect(five).toBeFocused();
  await expect(page.getByRole("button", { name: "Захиалах" })).toBeEnabled();
});
