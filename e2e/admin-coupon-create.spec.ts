import { test, expect } from "@playwright/test";

/**
 * Урамшуулал → купон үүсгэх drawer. Popup-ууд (Base UI combobox, Radix
 * select) <body>-д portal-оор гардаг тул тэдгээр дээр дарах, Escape дарах нь
 * drawer-ийг хаах ёсгүй — үүнийг зөвхөн бодит хөтөч шалгаж чадна.
 */
test.use({ viewport: { width: 390, height: 844 } });

const question = /Өөрчлөлтөө хадгалахгүй гарах уу/;
const bat = { id: "u-bat", full_name: "Бат", phone: "99112233" };

test.beforeEach(async ({ page }) => {
  await page.route("**/api/admin/customers/options**", (route) =>
    route.fulfill({ json: { items: [bat] } }),
  );
});

test("хувийн: хэрэглэгч сонгох, төрөл солих нь drawer-ийг хаахгүй", async ({
  page,
}) => {
  await page.goto("/admin/promotions?tab=personal");
  await page.getByRole("button", { name: "Хувийн купон үүсгэх" }).click();
  const drawer = page.getByRole("dialog", { name: "Хувийн купон үүсгэх" });
  await expect(drawer).toBeVisible();

  await drawer.getByRole("combobox").first().click();
  await page.getByLabel("Хэрэглэгч хайх").fill("9911");
  // Escape нь зөвхөн popup-ыг хаана.
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  await expect(page.getByText(question)).toHaveCount(0);

  await drawer.getByRole("combobox").first().click();
  await page.getByLabel("Хэрэглэгч хайх").fill("9911");
  await page.getByRole("option", { name: /Бат/ }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("combobox").first()).toContainText("Бат");
  await expect(page.getByText(question)).toHaveCount(0);

  await drawer.getByRole("combobox", { name: "Төрөл" }).click();
  await page.getByRole("option", { name: "Тогтсон дүн (₮)" }).click();
  await expect(drawer).toBeVisible();
  await expect(page.getByText(question)).toHaveCount(0);

  await page.screenshot({
    path: "test-results/coupon-create-drawer-mobile.png",
  });

  // Хэрэглэгч сонгосон = өөрчлөлттэй → нэг л удаа асууна.
  await drawer.getByRole("button", { name: "Болих", exact: true }).click();
  await expect(page.getByText(question)).toHaveCount(1);
  await page.getByRole("button", { name: "Хадгалахгүй гарах" }).click();
  await page.waitForTimeout(500);
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(question)).toHaveCount(0);

  // Дахин нээхэд хоосон эхэлнэ.
  await page.getByRole("button", { name: "Хувийн купон үүсгэх" }).click();
  await expect(
    page.getByRole("dialog").getByRole("combobox").first(),
  ).toContainText("Хэрэглэгч сонгоно уу");
});

test("хувийн: хэрэглэгчгүй үүсгэхийг зогсооно", async ({ page }) => {
  await page.goto("/admin/promotions?tab=personal");
  await page.getByRole("button", { name: "Хувийн купон үүсгэх" }).click();
  const drawer = page.getByRole("dialog", { name: "Хувийн купон үүсгэх" });
  await drawer.getByLabel("Код").fill("GIFT1");
  await drawer.getByRole("button", { name: "Үүсгэх" }).click();
  await expect(drawer.getByText("Хэрэглэгч сонгоно уу.")).toBeVisible();
  await expect(drawer).toBeVisible();
});

test("нийтийн: footer-ийн «Үүсгэх» маягтыг илгээж, drawer хаагдана", async ({
  page,
}) => {
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/admin/coupons", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    body = route.request().postDataJSON();
    await route.fulfill({ json: { id: "c1" } });
  });
  await page.goto("/admin/promotions");
  await page.getByRole("button", { name: "Нийтийн купон үүсгэх" }).click();
  const drawer = page.getByRole("dialog", { name: "Нийтийн купон үүсгэх" });
  await expect(drawer.getByText("Хэрэглэгч", { exact: true })).toHaveCount(0);
  await drawer.getByLabel("Код").fill("SALE10");
  await drawer.getByRole("button", { name: "Үүсгэх" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(question)).toHaveCount(0);
  expect(body).toMatchObject({ code: "SALE10", userId: null });
});

test("өөрчлөлтгүй бол «Болих» асуулгүй хаана", async ({ page }) => {
  await page.goto("/admin/promotions");
  await page.getByRole("button", { name: "Нийтийн купон үүсгэх" }).click();
  await page.getByRole("button", { name: "Болих", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(question)).toHaveCount(0);
});

test("дуусах огноо сонгогч drawer-ийг хаахгүй", async ({ page }) => {
  await page.goto("/admin/promotions");
  await page.getByRole("button", { name: "Нийтийн купон үүсгэх" }).click();
  const drawer = page.getByRole("dialog", { name: "Нийтийн купон үүсгэх" });
  await drawer.getByLabel("Дуусах огноо").click();
  // Огнооны dialog дээд давхаргад нээгдэж, drawer түр a11y-аас нуугдана.
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(drawer).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(drawer).toBeVisible();
  await expect(page.getByText(question)).toHaveCount(0);
});
