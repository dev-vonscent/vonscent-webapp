/**
 * Hero-гийн 3D савнуудын poster-уудыг (public/hero/*.avif) 3D-ийн ӨӨРӨӨС нь
 * screenshot хийж гаргана — камер, гэрэл, материал, харьцаа нь 3D-тэй яг ижил
 * тул poster → 3D солилт үл мэдэгдэнэ.
 *
 *   pnpm dev            # өөр терминалд
 *   pnpm hero:posters   # BASE_URL=… өөрчилж болно; hero-assets.json-ийг ч шинэчилнэ
 *
 * 3 theme (black / light / pink) × 2 layout (sm / md) × 4 хэмжээ = 24 файл.
 * **3D-ийн камер, материал, савны загвар, hero-гийн layout өөрчлөгдөх бүрд
 * дахин ажиллуул** — тэгэхгүй бол poster ба 3D зөрж, солигдохдоо «үсэрнэ».
 */
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import { chromium, type Page } from "@playwright/test";
import { computeHeroAssets, MANIFEST } from "./hero-assets";
import { ML_SIZES } from "@/lib/constants";
import {
  POSTER_THEMES,
  posterSrc,
  type PosterLayout,
  type PosterTheme,
} from "@/features/marketing/vial-specs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public");

/** Poster-ийн theme → next-themes-ийн жинхэнэ theme (navy = white-тэй ижил). */
const THEME_CLASS: Record<PosterTheme, string> = {
  black: "black",
  light: "white",
  pink: "pink",
};

/** md layout 768px-ээс. Утас: max-w-sm хайрцаг бүрэн өргөнөөрөө гарах өргөн. */
const VIEWPORT: Record<PosterLayout, { width: number; height: number }> = {
  sm: { width: 430, height: 900 },
  md: { width: 1440, height: 900 },
};

/** Сонголтын эргэлт (~2с) ба шингэний цалгилт намжих хугацаа. */
const SETTLE_MS = 4000;

/** Канваснаас бусдыг нууна — header, popup, grain overlay poster-т орохгүй. */
const ONLY_CANVAS = `
  body * { visibility: hidden !important; }
  [data-hero-3d] canvas { visibility: visible !important; }
`;

async function select(page: Page, ml: number) {
  // Хулганаар дарвал pointermove нь савнуудыг эргүүлнэ — шууд click event.
  await page
    .locator(`[data-hero-3d] input[type="radio"][value="${ml}"]`)
    .evaluate((el: HTMLInputElement) => el.click());
}

async function main() {
  const browser = await chromium.launch({
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
  let total = 0;
  try {
    for (const layout of ["sm", "md"] as const) {
      for (const theme of POSTER_THEMES) {
        const ctx = await browser.newContext({
          viewport: VIEWPORT[layout],
          deviceScaleFactor: 2,
          reducedMotion: "no-preference",
        });
        await ctx.addInitScript((t) => {
          localStorage.setItem("theme", t);
        }, THEME_CLASS[theme]);
        const page = await ctx.newPage();
        await page.goto(BASE, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: ONLY_CANVAS });
        await page
          .locator('[data-hero-3d="ready"]')
          .waitFor({ state: "attached", timeout: 60_000 });
        const canvas = page.locator("[data-hero-3d] canvas");

        for (const ml of ML_SIZES) {
          await select(page, ml);
          await page.waitForTimeout(SETTLE_MS);
          const png = await canvas.screenshot({ type: "png" });
          const file = path.join(OUT, posterSrc(theme, layout, ml));
          fs.mkdirSync(path.dirname(file), { recursive: true });
          const info = await sharp(png)
            .avif({ quality: 72, effort: 9 })
            .toFile(file);
          total += info.size;
          console.log(
            `${path.relative(process.cwd(), file)}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)}KB`,
          );
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`нийт ${(total / 1024).toFixed(0)}KB`);
  // Poster-ууд immutable кэштэй — шинэ hash-аар URL солигдоно.
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(computeHeroAssets(), null, 2) + "\n",
  );
  console.log("hero-assets.json шинэчлэгдэв");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
