import { test, expect, devices, type Page } from "@playwright/test";

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
  await page
    .locator("[data-hero-3d]")
    .waitFor({ state: "attached", timeout: 60_000 });
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
    await page.waitForLoadState("networkidle");

    expect(assets.posters()).toEqual(["/hero/vials-black-md-10.avif"]);
    expect(assets.models()).toEqual([]);
    await expect(hero.locator("canvas")).toHaveCount(0);
  });

  test("theme-д таарах poster-ийг татна", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "pink"));
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    await page.waitForLoadState("networkidle");
    expect(assets.posters()).toEqual(["/hero/vials-pink-md-10.avif"]);
  });

  test("хэмжээ солиход poster солигдоно", async ({ page }) => {
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    await page.waitForLoadState("networkidle");
    await page.getByText("20мл", { exact: true }).click();
    await expect
      .poll(() => assets.posters())
      .toContain("/hero/vials-black-md-20.avif");
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
    await page.waitForLoadState("networkidle");
    // idle callback-ийн хугацаа (2.5с) өнгөрсөн ч хүрээгүй тул унтраатай.
    await page.waitForTimeout(3000);
    await expect(page.locator("[data-hero-3d]")).toHaveAttribute(
      "data-hero-3d",
      "off",
    );
    expect(assets.models()).toEqual([]);
    expect(assets.posters()).toEqual(["/hero/vials-black-sm-10.avif"]);

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
  test("3D idle үед ачаалагдаж, gainmap JPG татна", async ({ page }) => {
    const assets = trackHeroAssets(page);
    await gotoHome(page);
    test.skip(
      !(await hasWebGL2(page)),
      "GPU-тэй WebGL2 алга (SwiftShader) — 3D ачаалагдахгүй",
    );
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
