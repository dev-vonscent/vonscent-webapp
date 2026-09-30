/**
 * Савны зургийн эх хувиудыг Storage-ийн `bottles/<style>.webp` руу оруулна.
 * Шинэ бараа нэмэхэд админ аль нэгийг нь сонговол `addBottleImage()` эндээс
 * хуулж галерейд нэмнэ (src/features/admin/bottle-image.ts).
 *
 *   pnpm db:bottle-images-dev --dry
 *   pnpm db:bottle-images-dev
 *   pnpm db:bottle-images-prod
 *
 * Эх файлууд: public/bottles/ (формын урьдчилан харах зураг ч мөн эдгээр —
 * constants `BOTTLE_STYLE_PREVIEW`). Давхар ажиллуулахад аюулгүй: дарж бичнэ.
 */
import * as fs from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { BOTTLE_STYLES, BOTTLE_STYLE_PREVIEW } from "@/lib/constants";

const MAX_EDGE = 1600;
const QUALITY = 88;

const dryRun = process.argv.includes("--dry");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images";
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  for (const style of BOTTLE_STYLES) {
    const file = `public${BOTTLE_STYLE_PREVIEW[style]}`;
    if (!fs.existsSync(file)) throw new Error(`Файл алга: ${file}`);
    const webp = await sharp(fs.readFileSync(file))
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    console.log(
      `· bottles/${style}.webp ← ${file} (${Math.round(webp.length / 1024)}KB)`,
    );
    if (dryRun) continue;
    const { error } = await sb.storage
      .from(bucket)
      .upload(`bottles/${style}.webp`, webp, {
        contentType: "image/webp",
        upsert: true,
        // Эх хувь нь солигдож болох тул урт кэш өгөхгүй — бүтээгдэхүүн бүрийн
        // хуулбар л UUID-тай, хувиршгүй.
        cacheControl: "3600",
      });
    if (error) throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
