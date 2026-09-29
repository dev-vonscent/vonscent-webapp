import { test, expect } from "@playwright/test";

// iPhone 15 — доод цэс ба наалдсан зурвасууд зөвхөн утасны өргөнд гардаг.
test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

const nav = 'nav[aria-label="Үндсэн цэс"]';
const bar = '[data-slot="bottom-bar"]';

test("product buy bar appears only after scrolling past the in-page CTA", async ({
  page,
}) => {
  await page.goto("/products/dior-sauvage-edp");
  await expect(page.getByRole("heading", { name: "Sauvage" })).toBeVisible();

  // Хуудас нээгдэхэд CTA дэлгэцийн доор байсан ч зурвас ГАРАХГҮЙ — өмнө нь
  // энд «хальт» гараад CTA хүрмэгц алга болдог байв.
  await expect(page.locator(nav)).toBeInViewport();
  await expect(page.locator(bar)).not.toBeInViewport();

  // CTA-г давж гүйлгэсний дараа зурвас цэсний оронд сууна. `scrollTo` —
  // хуудасны баримтын координатаар, CTA блокийн сүүлчийн товчноос 1px доош.
  const scrollPast = (selector: string, extra: number) =>
    page.evaluate(
      ([s, e]) => {
        const el = [...document.querySelectorAll("button")].find(
          (b) => b.textContent?.trim() === s,
        )!;
        window.scrollTo(0, el.getBoundingClientRect().bottom + scrollY + e);
      },
      [selector, extra] as const,
    );
  await scrollPast("Сагсанд нэмэх", 1);
  await expect(page.locator(bar)).toBeInViewport();
  await expect(page.locator(nav)).not.toBeInViewport();
  await expect(
    page.locator(bar).getByRole("button", { name: "Захиалах" }),
  ).toBeVisible();

  // Богино тайлбартай бараан дээр ч зурвас «хальт» гараад алга болохгүй —
  // хэсэг гүйлгэхэд хэвээр үлдэнэ.
  await scrollPast("Сагсанд нэмэх", 200);
  await expect(page.locator(bar)).toBeInViewport();

  // «Төстэй бараа»-г үзэж эхлэхэд тэдгээрийн товчийг дарахгүй зайлна.
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(page.locator(bar)).not.toBeInViewport();
  await expect(page.locator(nav)).toBeInViewport();

  // Буцаж дээш — зурвас гулсаж гараад цэс эргэж ирнэ.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(bar)).not.toBeInViewport();
  await expect(page.locator(nav)).toBeInViewport();
});

test("bottom bars follow the visual viewport when iOS leaves it offset", async ({
  page,
}) => {
  await page.goto("/");
  const box = () => page.locator(nav).boundingBox();
  const before = await box();

  // `VisualViewportSync`-ийн тавьдаг утгыг шууд тавьж, CSS-ийн холбоос
  // (`bottom-visual`) ажиллаж буйг шалгана.
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--visual-bottom", "-330px"),
  );
  await expect.poll(async () => (await box())!.y - before!.y).toBe(330);
});
