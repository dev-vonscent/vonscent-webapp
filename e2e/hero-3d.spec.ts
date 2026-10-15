import { test, expect, devices, type Page } from "@playwright/test";
import { HERO_DEFAULT_ML } from "../src/features/marketing/vial-specs";

/**
 * Hero-гийн 3D / poster-ийн ачаалах дүрэм (docs/planning/hero-3d-performance.md):
 *  - poster нь theme × өргөнд таарах НЭГ л зураг татна (preload + CSS нэг URL);
 *  - reduced-motion үед 3D огт ачаалагдахгүй;
 *  - хүрэлтийн дэлгэц дээр 3D нь hero-г хүрэх хүртэл ачаалагдахгүй;
 *  - орчны зураг gainmap JPG — RGBE `.hdr` татагдахгүй.
 */

/** `/hero/*.avif`, `/models/*` хүсэлтүүдийг цуглуулна. */
function trackHeroAssets(page: Page) {
  const urls: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/hero/") || u.pathname.startsWith("/models/"))
      urls.push(u.pathname);
  });
  return {
    posters: () => urls.filter((u) => u.startsWith("/hero/")),
    models: () => urls.filter((u) => u.startsWith("/models/")),
  };
}

/**
 * Нүүр хуудас — hero гартал хүлээнэ. Нүүр нь stream хийгддэг (loading.tsx)
 * тул олон тест зэрэг ажиллахад 5с-ийн анхдагч хүлээлт хүрэлцдэггүй.
 */
async function gotoHome(page: Page) {
  await page.goto("/");
  // Stream-ийн солилтын үед hero түр хоёр хувь DOM-д байдаг (`S:0`) —
  // ганц үлдтэл хүлээнэ, эс бөгөөс locator strict mode-оор унана.
  await page.waitForFunction(
    () => document.querySelectorAll("[data-hero-3d]").length === 1,
    undefined,
    { timeout: 60_000 },
  );
}

/** Нэмэлт хүсэлт (давхар poster, 3D) гарах эсэхийг ажиглах хугацаа. */
const SETTLE_MS = 1500;

/**
 * Poster ирэхийг хүлээгээд, хэсэг хугацааны дараа ч зөвхөн тэр нэг нь
 * татагдсан хэвээр байгааг батална. `networkidle` хэрэглэхгүй: нүүрний
 * бусад хүсэлт (зураг, prefetch) дуусахгүй удвал тест хамааралгүйгээр
 * гацдаг байв (CI run 38280375109).
 */
async function expectOnlyPoster(
  page: Page,
  assets: ReturnType<typeof trackHeroAssets>,
  poster: string,
) {
  await expect.poll(() => assets.posters()).toContain(poster);
  await page.waitForTimeout(SETTLE_MS);
  expect(assets.posters()).toEqual([poster]);
}

/** Апп-ын `hasHardwareWebGL2`-тэй ижил: программ renderer (SwiftShader) дээр 3D ачаалагдахгүй. */
async function hasWebGL2(page: Page) {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const r = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    return !/swiftshader|llvmpipe|softpipe|software/i.test(r);
  });
}

test.describe("reduced-motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("poster ганцаараа, 3D ачаалагдахгүй", async ({ page }) => {
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    const hero = page.locator("[data-hero-3d]");
    await expect(hero).toHaveAttribute("data-hero-3d", "off");
    await expectOnlyPoster(
      page,
      assets,
      `/hero/vials-black-md-${HERO_DEFAULT_ML}.avif`,
    );
    expect(assets.models()).toEqual([]);
    await expect(hero.locator("canvas")).toHaveCount(0);
  });

  test("theme-д таарах poster-ийг татна", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "pink"));
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    await expectOnlyPoster(
      page,
      assets,
      `/hero/vials-pink-md-${HERO_DEFAULT_ML}.avif`,
    );
  });

  test("хэмжээ солиход poster солигдоно", async ({ page }) => {
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    await expect
      .poll(() => assets.posters())
      .toContain(`/hero/vials-black-md-${HERO_DEFAULT_ML}.avif`);
    // Анхдагчаас (HERO_DEFAULT_ML) өөр хэмжээ — эс бөгөөс юу ч солигдохгүй.
    await page.getByText("5мл", { exact: true }).click();
    await expect
      .poll(() => assets.posters())
      .toContain("/hero/vials-black-md-5.avif");
    await expect(page.locator("[data-hero-3d]")).toHaveAttribute(
      "data-hero-3d",
      "off",
    );
  });
});

test.describe("хүрэлтийн дэлгэц", () => {
  // defaultBrowserType-ийг describe дотор солих боломжгүй (шинэ worker) тул
  // төхөөрөмжийн бусад талбарыг л авна.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
    devices["Pixel 7"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test("hero-г хүртэл 3D ачаалагдахгүй, хүрэхэд ачаална", async ({ page }) => {
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    await expect
      .poll(() => assets.posters())
      .toContain(`/hero/vials-black-sm-${HERO_DEFAULT_ML}.avif`);
    // idle callback-ийн хугацаа (2.5с) өнгөрсөн ч хүрээгүй тул унтраатай.
    await page.waitForTimeout(3000);
    await expect(page.locator("[data-hero-3d]")).toHaveAttribute(
      "data-hero-3d",
      "off",
    );
    expect(assets.models()).toEqual([]);
    expect(assets.posters()).toEqual([
      `/hero/vials-black-sm-${HERO_DEFAULT_ML}.avif`,
    ]);

    test.skip(
      !(await hasWebGL2(page)),
      "GPU-тэй WebGL2 алга (SwiftShader) — 3D ачаалагдахгүй",
    );
    await page.getByText("5мл", { exact: true }).tap();
    await expect(page.locator("[data-hero-3d]")).not.toHaveAttribute(
      "data-hero-3d",
      "off",
    );
    await expect.poll(() => assets.models()).toContain("/models/vials.glb");
  });
});

test.describe("хулгана (desktop)", () => {
  test("hero-тэй харьцах хүртэл 3D-гүй, дараа нь gainmap JPG татна", async ({
    page,
  }) => {
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    await expect
      .poll(() => assets.posters())
      .toContain(`/hero/vials-black-md-${HERO_DEFAULT_ML}.avif`);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator("[data-hero-3d]")).toHaveAttribute(
      "data-hero-3d",
      "off",
    );
    expect(assets.models()).toEqual([]);

    test.skip(
      !(await hasWebGL2(page)),
      "GPU-тэй WebGL2 алга (SwiftShader) — 3D ачаалагдахгүй",
    );
    await page.locator("[data-hero-3d]").hover();
    await page.mouse.move(400, 300);
    await expect(page.locator("[data-hero-3d]")).toHaveAttribute(
      "data-hero-3d",
      "ready",
      { timeout: 60_000 },
    );
    const models = assets.models();
    expect(models).toContain("/models/vials.glb");
    expect(models).toContain("/models/studio_dark.jpg");
    expect(models.some((u) => u.endsWith(".hdr"))).toBe(false);
  });
});
