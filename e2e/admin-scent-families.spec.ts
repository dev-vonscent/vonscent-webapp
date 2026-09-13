import { test, expect, type Page } from "@playwright/test";

/**
 * Админ → Үнэрийн төрөл: дүрсээ оруулаагүй бол сервер AI-аар үүсгэж, бэлэн
 * болмогц мөрөнд нь бичдэг (`/api/admin/scent-families` → `after()`).
 *
 * Demo горимд жинхэнэ үүсгэлт явахгүй тул хүсэлтийг таслан авч серверийн
 * хариуг дуурайлгана — энд шалгагдаж байгаа зүйл нь UI-ийн зан төлөв:
 * форм илгээгдэх, хүлээлтийн мэдээлэл гарах, тухайн мөр дээр эргэлдэх тэмдэг
 * суух. Demo горим админы хэсгийг нээлттэй үлдээдэг (admin.spec.ts).
 */

/**
 * Маягтыг бөглөөд илгээнэ. Hydration дуустал хуудасны эхний зураглал хоёр
 * хувь зэрэг оршиж болдог тул талбар нэгээрээ тогтсон хойно бичнэ.
 */
async function fillNewFamily(page: Page, label: string, slug: string) {
  const name = page.getByPlaceholder("Гурмет");
  await expect(name).toHaveCount(1);
  await name.fill(label);
  await page.getByPlaceholder("gourmand").fill(slug);
  await page.getByRole("button", { name: "Нэмэх" }).click();
}

test("төрөл нэмэхэд дүрсийг AI үүсгэж байгааг харуулна", async ({ page }) => {
  await page.route("**/api/admin/scent-families", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, generatingIcon: true }),
    });
  });

  await page.goto("/admin/scent-families");
  await expect(
    page.getByRole("heading", { name: "Шинэ төрөл нэмэх" }),
  ).toBeVisible();
  // Дүрс заавал биш гэдэг нь — хоосон бол AI үүсгэнэ.
  await expect(page.getByText("Дүрс (хоосон бол AI үүсгэнэ)")).toBeVisible();

  await fillNewFamily(page, "Утаат", "smoky");
  await expect(page.getByText(/Дүрсийг AI үүсгэж байна/)).toBeVisible();
});

test("demo горимд хадгалагдахгүйг хэлнэ", async ({ page }) => {
  await page.goto("/admin/scent-families");
  await fillNewFamily(page, "Утаат", "smoky");
  await expect(page.getByText(/Demo горим/)).toBeVisible();
});
