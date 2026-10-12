import { test, expect } from "@playwright/test";

/**
 * Админ → Шинэ бараа: «Идэвхтэй (нийтлэх)» checkbox-ийн оронд гурван төлөв
 * (0125). «Тун удахгүй» сонгоход ойролцоо хугацааны талбар, үлдэгдлийн
 * зөвлөмж гарна. Demo горим админы хэсгийг нээлттэй үлдээдэг (admin.spec.ts).
 */
test("шинэ барааны төлөв: Нуусан / Тун удахгүй / Идэвхтэй", async ({
  page,
}) => {
  await page.goto("/admin/products/new");
  const group = page.getByRole("radiogroup", { name: "Барааны төлөв" });
  const radio = (name: RegExp) => group.getByRole("radio", { name });

  // Анхдагч нь өмнөх «нийтлэх»-тэй ижил.
  await expect(radio(/Идэвхтэй/)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel(/Хэзээ ирэх вэ/)).toHaveCount(0);

  // Шинэ бараа хэзээ ч гараагүй тул «Тун удахгүй» нээлттэй.
  await radio(/Тун удахгүй/).click();
  await expect(radio(/Тун удахгүй/)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel(/Хэзээ ирэх вэ/)).toBeVisible();
  await expect(page.getByText(/Ус хараахан ирээгүй бол 0/)).toBeVisible();

  await radio(/Нуусан/).click();
  await expect(page.getByLabel(/Хэзээ ирэх вэ/)).toHaveCount(0);
});
