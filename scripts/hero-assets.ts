/**
 * Hero-гийн статик файлуудын (public/hero, public/models) хувилбарын manifest.
 *
 *   pnpm hero:assets
 *
 * `next.config.ts` эдгээрт `Cache-Control: immutable` (1 жил) өгдөг тул URL нь
 * агуулгаараа өөрчлөгдөх ёстой — `heroAsset()` `?v=<hash>` залгана. Файл
 * солигдоод энэ script ажиллаагүй бол хэрэглэгчид хуучин хувилбар нь 1 жил
 * үлдэнэ; `hero-assets.test.ts` үүнийг `pnpm test` дээр барина.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

const PUBLIC = path.join(process.cwd(), "public");
export const HERO_ASSET_DIRS = ["hero", "models"] as const;
export const MANIFEST = path.join(
  process.cwd(),
  "src/features/marketing/hero-assets.json",
);

export function computeHeroAssets(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const dir of HERO_ASSET_DIRS) {
    for (const name of fs.readdirSync(path.join(PUBLIC, dir)).sort()) {
      if (name.startsWith(".")) continue;
      const buf = fs.readFileSync(path.join(PUBLIC, dir, name));
      out[`/${dir}/${name}`] = createHash("sha256")
        .update(buf)
        .digest("hex")
        .slice(0, 10);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = computeHeroAssets();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`hero-assets.json: ${Object.keys(manifest).length} файл`);
}
