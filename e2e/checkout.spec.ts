import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Pick an option from a Radix select opened by clicking `trigger`.
 *
 * `scope` нь хуудас эсвэл түүний нэг хэсэг (жишээ нь хаягийн цонх) — хуудсан
 * дээр combobox олон байх тул индексийг хашихад хэрэгтэй.
 *
 * Сонголтыг **гараас** хийж байна, товшилтоор биш: Radix-ийн жагсаалт нь
 * portal-аар гарч, өөрийн гүйлттэй байдаг тул урт жагсаалтад (204 хороо)
 * Playwright «element is outside of the viewport» гээд унадаг. Сумаар
 * гүйлгэхэд жагсаалт өөрөө идэвхтэй мөр рүүгээ гүйдэг.
 */
async function pickOption(
  scope: Page | Locator,
  triggerIndex: number,
  option?: string,
) {
  const page = "page" in scope ? scope.page() : scope;
  await scope.getByRole("combobox").nth(triggerIndex).click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();

  if (option) {
    const wanted = listbox.getByRole("option", { name: option, exact: true });
    // Radix нь идэвхтэй мөрөө дагаж гүйдэг — хүссэн мөр дээрээ хүрэх хүртэл
    // сумдана. 204 хороо бол хамгийн урт нь.
    for (let i = 0; i < 250; i += 1) {
      if (await wanted.evaluate((el) => el.dataset.highlighted !== undefined)) {
        break;
      }
      await page.keyboard.press("ArrowDown");
    }
    await expect(wanted).toHaveAttribute("data-highlighted", "");
  } else {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
  await expect(listbox).toBeHidden();
}

test("guest places a demo order end to end", async ({ page }) => {
  await page.goto("/products/dior-sauvage-edp");
  await page
    .getByRole("button", { name: /Сагсанд нэмэх/ })
    .first()
    .click();

  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Захиалга өгөх" }),
  ).toBeVisible();

  await page.getByPlaceholder("Хүлээн авах хүний нэр").fill("Тест Хэрэглэгч");
  const phone = page.getByPlaceholder("99112233");
  await phone.fill("99118822");
  await expect(phone).toHaveValue("99118822");

  // Хаяг нь өөрөө нэг цонх: хуудсан дээр талбарууд нь шууд байхгүй, «Шинэ
  // хаяг нэмэх» товч нь `AddressDialog`-ыг нээнэ.
  await page.getByRole("button", { name: "Шинэ хаяг нэмэх" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Address cascade: city → district → khoroo (UB only). The district must be
  // a deliverable one — the first option, Багануур, is seeded into the
  // no-delivery X zone (0043_zone_areas_seed.sql) and blocks the submit button.
  // Индексүүд нь ЦОНХ доторх combobox-ууд — хуудсан дээр «Хүргүүлэх өдөр»
  // гэсэн өөр combobox байдаг тул хайлтыг цонхоор хашина.
  await pickOption(dialog, 0, "Улаанбаатар");
  await pickOption(dialog, 1, "Баянгол");
  // Тодорхой хороо нэрлэв: Radix-ийн жагсаалт урт бөгөөд гүйлгэгддэг тул
  // «эхний сонголт» нь дэлгэцийн гадна үлдэж, товшилт бүтэлгүйтдэг.
  await pickOption(dialog, 2, "1-р хороо");
  await dialog.getByPlaceholder("Байр, орц, тоот").fill("45-р байр 12 тоот");
  await dialog.getByRole("button", { name: "Хаяг хэрэглэх" }).click();
  await expect(dialog).toBeHidden();

  // Товч нь захиалгыг баталгаажуулдаггүй, төлбөр рүү дамжуулдаг. Утсан дээр
  // наалдсан зурвас нь ижил товчийг давхар гаргадаг тул эхнийхийг нь авна.
  await page
    .getByRole("button", { name: /Төлбөр төлөх/ })
    .first()
    .click();

  // A guest gets a "no loyalty points" interstitial before the order posts.
  await page.getByRole("button", { name: "Зочноор үргэлжлүүлэх" }).click();

  await expect(page).toHaveURL(/\/order\/success/, { timeout: 15_000 });
});

/**
 * Төлбөрийн хуудаснаас мөрөө засах (клиент, 2026-09 UG): урьд нь тоо, хэмжээ
 * солих, устгах боломжгүй тул засах гэж буцсан хэрэглэгч сагсаа эхнээс нь
 * бүрдүүлдэг байв. Засвар сагсны store руу шууд бичигдэх тул сагс ижил.
 */
test("edits a line in checkout and finds it the same in the cart", async ({
  page,
}) => {
  await page.goto("/products/dior-sauvage-edp");
  await page
    .getByRole("button", { name: /Сагсанд нэмэх/ })
    .first()
    .click();

  await page.goto("/checkout");
  const plus = page.getByRole("button", { name: /— нэгээр нэмэх$/ }).first();
  await expect(plus).toBeVisible();
  await plus.click();
  // 1 → 2: «−» идэвхжинэ (1 дээр идэвхгүй).
  await expect(
    page.getByRole("button", { name: /— нэгээр хасах$/ }).first(),
  ).toBeEnabled();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Таны сагс" })).toBeVisible();
  // Сагсны мөрийн stepper нь 2-ыг харуулна.
  await expect(
    page.locator("span.tabular-nums").filter({ hasText: /^2$/ }).first(),
  ).toBeVisible();

  // Устгавал сагс ч хоосорно — checkout ба сагс нэг л store.
  await page.goto("/checkout");
  await page
    .getByRole("button", { name: /— устгах$/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Сагс хоосон байна" }),
  ).toBeVisible();
});
