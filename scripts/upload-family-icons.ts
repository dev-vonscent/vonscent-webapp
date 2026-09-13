/**
 * Үнэрийн төрлийн дүрсийг repo-гоос Supabase Storage руу оруулж, мөрөнд нь
 * заана.
 *
 *   node --env-file=.env --import tsx scripts/upload-family-icons.ts --dry
 *   node --env-file=.env --import tsx scripts/upload-family-icons.ts
 *   node --env-file=.env --import tsx scripts/upload-family-icons.ts --force
 *
 * 0018-ийн seed нь `icon_url`-д `/family-<slug>.png` гэсэн repo доторх замыг
 * бичдэг байсан. Тэр нь ажилладаг ч дүрс кодтой хамт deploy хийгддэг тул
 * админ хуудсан дээрээс солих боломжгүй, AI-аар үүсгэсэн шинэ дүрстэй ч
 * хоёр өөр эх сурвалж болдог. Энэ script нь `public/family-<slug>.png`
 * файлуудыг Storage-ийн `families/` фолдер руу (upload route-тай ижил
 * боловсруулалт: 256px WebP, alpha хэвээр) хийж, `icon_url`-ыг нийтийн URL
 * болгоно — ингэснээр сайт бүх дүрсээ өгөгдлийн сангаас уншина.
 *
 * Давхар ажиллуулахад аюулгүй: Storage-д аль хэдийн байгаа мөрийг алгасна
 * (`--force` бол дахин оруулна). Файл нь дутуу төрөл хэвээрээ үлдэнэ.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const DIR = "public";
/** `IMAGE_PRESETS.icon`-той ижил — дүрс 64px-д буудаг. */
const MAX_EDGE = 256;
const QUALITY = 85;

const dryRun = process.argv.includes("--dry");
const force = process.argv.includes("--force");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images";
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

function publicUrl(objectPath: string): string {
  return `${url!.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;
}

function fileFor(slug: string): string | null {
  for (const ext of ["png", "webp", "jpg"]) {
    const p = path.join(DIR, `family-${slug}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const { data, error } = await sb
    .from("scent_families")
    .select("slug, label, icon_url")
    .order("sort_order");
  if (error) throw error;
  const families = (data ?? []) as {
    slug: string;
    label: string;
    icon_url: string | null;
  }[];

  const missing: string[] = [];
  let changed = 0;

  for (const f of families) {
    const alreadyInStorage = f.icon_url?.includes("/storage/v1/object/public/");
    if (alreadyInStorage && !force) {
      console.log(`· ${f.slug.padEnd(10)} Storage-д байна — алгаслаа`);
      continue;
    }
    const file = fileFor(f.slug);
    if (!file) {
      missing.push(f.slug);
      continue;
    }

    // Alpha сувгийг хадгална — дүрс гурван загварын дэвсгэр дээр буудаг.
    const webp = await sharp(file)
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY })
      .toBuffer();

    const objectPath = `families/${f.slug}-${randomUUID()}.webp`;
    if (dryRun) {
      console.log(
        `→ ${f.slug.padEnd(10)} ${file} → ${objectPath} (${Math.round(webp.length / 1024)}KB)`,
      );
      changed += 1;
      continue;
    }

    const up = await sb.storage.from(bucket).upload(objectPath, webp, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "31536000",
    });
    if (up.error) {
      console.error(`✖ ${f.slug}: upload — ${up.error.message}`);
      continue;
    }
    const { error: updateError } = await sb
      .from("scent_families")
      .update({ icon_url: publicUrl(objectPath) })
      .eq("slug", f.slug);
    if (updateError) {
      console.error(`✖ ${f.slug}: update — ${updateError.message}`);
      continue;
    }
    console.log(`✓ ${f.slug.padEnd(10)} → ${objectPath}`);
    changed += 1;
  }

  if (missing.length)
    console.log(`\nФайлгүй төрөл (хэвээр үлдлээ): ${missing.join(", ")}`);
  console.log(
    dryRun ? `\n--dry: ${changed} мөр өөрчлөгдөх байсан.` : `\n${changed} мөр шинэчлэгдлээ.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
