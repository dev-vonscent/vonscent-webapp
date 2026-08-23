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
  await page.getByRole("button", { name: /Сагсанд нэмэх/ }).first().click();

  // The cart badge appears on the header trigger.
  const cartButton = page.getByRole("button", { name: "Сагс", exact: true });
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
