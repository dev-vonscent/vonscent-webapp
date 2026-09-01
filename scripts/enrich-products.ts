/**
 * Fill in the catalogue detail the client's Excel left blank, from a manifest
 * of crawled-and-written data.
 *
 *   pnpm db:enrich-products docs/import/enrichment/<file>.json --dry
 *   pnpm db:enrich-products docs/import/enrichment/<file>.json
 *
 * The Excel import (scripts/import-products.ts) only carries what the client
 * typed: name, brand, gender, concentration, bottle ml and the four decant
 * prices. Everything a customer actually reads — the notes, the Mongolian
 * copy, the picture — is researched per product and lands here.
 *
 * One entry per product, keyed by the slug the import created. Every field
 * except `slug` is optional; whatever is present is written, whatever is
 * absent is left alone, so a manifest can be re-run after a correction.
 *
 * The image is downloaded from `imageUrl`, flattened onto white (a packshot
 * PNG is usually transparent, and the storefront card is white), bounded to
 * 1600px and re-encoded to WebP — the same treatment an admin upload gets in
 * src/lib/storage/process-image.ts — then uploaded to the product-images
 * bucket. Products carry exactly one picture, so the gallery is replaced
 * rather than appended to.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { SEASONS } from "../src/lib/constants";
import { WHITE_LUMA, backgroundLuma } from "./lib/image-checks";

const FLAGS = ["--dry", "--keep-images"];
const args = process.argv.slice(2).filter((a) => !FLAGS.includes(a));
const dryRun = process.argv.includes("--dry");
/** Skip the download/upload leg and write only the text fields. */
const keepImages = process.argv.includes("--keep-images");
const file = args[0];

if (!file) {
  console.error(
    "Usage: pnpm db:enrich-products <manifest.json> [--dry] [--keep-images]",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dryRun && (!url || !key)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase =
  !dryRun && url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";
/** Matches IMAGE_PRESETS.photo in src/lib/storage/process-image.ts. */
const MAX_EDGE = 1600;
const WEBP_QUALITY = 82;

/** Some brand CDNs 403 an unbranded client. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface Entry {
  slug: string;
  /** Source image to download. Omit to leave the existing gallery alone. */
  imageUrl?: string;
  /** Page the copy and notes were taken from — provenance, not stored in DB. */
  sourceUrl?: string;
  scentFamilies?: string[];
  seasons?: string[];
  notesTop?: string[];
  notesHeart?: string[];
  notesBase?: string[];
  shortDescription?: string;
  description?: string;
  notesDescription?: string;
  usageDescription?: string;
  originCountry?: string;
  releaseYear?: number;
  customTags?: string[];
}

function readManifest(): Entry[] {
  const raw = fs.readFileSync(file, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Manifest must be a JSON array.");
  return parsed as Entry[];
}

/**
 * Download, flatten onto white, bound, re-encode. Returns null (with a reason
 * logged) rather than throwing, so one dead CDN link cannot abort a run.
 */
async function fetchImage(
  src: string,
): Promise<{
  data: Buffer;
  width: number;
  height: number;
  /** Border-ring median luminance 0-255; ~255 is a clean white packshot. */
  corner: number;
} | null> {
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(src, {
      headers: { "user-agent": UA, accept: "image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`      ✗ download HTTP ${res.status}`);
      return null;
    }
    bytes = await res.arrayBuffer();
  } catch (e) {
    console.error(`      ✗ download failed: ${(e as Error).message}`);
    return null;
  }
  if (bytes.byteLength < 1024) {
    console.error(`      ✗ download too small (${bytes.byteLength}B)`);
    return null;
  }
  try {
    const { data, info } = await sharp(Buffer.from(bytes), { failOn: "error" })
      .rotate()
      // A packshot arrives as a transparent PNG as often as not; compositing
      // it onto white is what makes the card read as a white-background shot
      // instead of a black one in dark mode.
      .flatten({ background: "#ffffff" })
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      corner: await backgroundLuma(data),
    };
  } catch (e) {
    console.error(`      ✗ not a decodable image: ${(e as Error).message}`);
    return null;
  }
}

function textPatch(e: Entry): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (e.scentFamilies?.length) patch.scent_families = e.scentFamilies;
  if (e.seasons?.length) patch.seasons = e.seasons;
  if (e.notesTop?.length) patch.notes_top = e.notesTop;
  if (e.notesHeart?.length) patch.notes_heart = e.notesHeart;
  if (e.notesBase?.length) patch.notes_base = e.notesBase;
  if (e.shortDescription) patch.short_description = e.shortDescription;
  if (e.description) patch.description = e.description;
  if (e.notesDescription) patch.notes_description = e.notesDescription;
  if (e.usageDescription) patch.usage_description = e.usageDescription;
  if (e.originCountry) patch.origin_country = e.originCountry;
  if (e.releaseYear) patch.release_year = e.releaseYear;
  return patch;
}

function validate(entries: Entry[], families: Set<string>, tags: Set<string>) {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const at = `«${e.slug}»`;
    if (!e.slug) errors.push("slug хоосон бичлэг байна.");
    if (seen.has(e.slug)) errors.push(`${at}: manifest дотор давхардсан.`);
    seen.add(e.slug);
    for (const f of e.scentFamilies ?? [])
      if (families.size && !families.has(f))
        errors.push(`${at}: үнэрийн бүл «${f}» DB-д алга.`);
    for (const s of e.seasons ?? [])
      if (!(SEASONS as readonly string[]).includes(s))
        errors.push(`${at}: улирал «${s}» буруу.`);
    for (const t of e.customTags ?? [])
      if (tags.size && !tags.has(t))
        errors.push(`${at}: нэмэлт таг «${t}» DB-д алга.`);
    if (e.releaseYear && (e.releaseYear < 1900 || e.releaseYear > 2100))
      errors.push(`${at}: гарсан он «${e.releaseYear}» боломжгүй.`);
    if (e.imageUrl && !/^https?:\/\//.test(e.imageUrl))
      errors.push(`${at}: imageUrl нь бүтэн http(s) хаяг байх ёстой.`);
  }
  return errors;
}

async function main() {
  const entries = readManifest();
  console.log(`${path.basename(file)}: ${entries.length} бичлэг`);

  // Taxonomy + slug existence come from the DB; --dry validates shape only.
  let families = new Set<string>();
  let tagIdBySlug = new Map<string, string>();
  let known = new Set<string>();
  if (supabase) {
    const [{ data: fams }, { data: ctags }, { data: prods }] =
      await Promise.all([
        supabase.from("scent_families").select("slug"),
        supabase.from("custom_tags").select("id, slug"),
        supabase
          .from("products")
          .select("slug")
          .in(
            "slug",
            entries.map((e) => e.slug),
          ),
      ]);
    families = new Set((fams ?? []).map((f: { slug: string }) => f.slug));
    tagIdBySlug = new Map(
      (ctags ?? []).map((t: { id: string; slug: string }) => [t.slug, t.id]),
    );
    known = new Set((prods ?? []).map((p: { slug: string }) => p.slug));
  }

  const errors = validate(
    entries,
    families,
    new Set(tagIdBySlug.keys()),
  );
  if (supabase)
    for (const e of entries)
      if (!known.has(e.slug)) errors.push(`«${e.slug}»: DB-д ийм бараа алга.`);

  if (errors.length) {
    console.error(`\n${errors.length} алдаа — цуцлав:\n`);
    errors.forEach((m) => console.error("  • " + m));
    process.exit(1);
  }

  if (dryRun || !supabase) {
    for (const e of entries) {
      const bits = [
        e.imageUrl ? "зураг" : "зураггүй",
        e.description ? "танилцуулга" : "",
        e.notesTop?.length ? `${e.notesTop.length}+${e.notesHeart?.length ?? 0}+${e.notesBase?.length ?? 0} нот` : "",
        (e.scentFamilies ?? []).join("/"),
      ].filter(Boolean);
      console.log(`  • ${e.slug} — ${bits.join(" · ")}`);
    }
    console.log("\n✓ Бүтэц зөв. DB-д хүрээгүй (--dry).");
    return;
  }

  let ok = 0;
  let imaged = 0;
  const failedImages: string[] = [];
  const greyBackgrounds: string[] = [];

  for (const e of entries) {
    console.log(`  ~ ${e.slug}`);

    const patch = textPatch(e);
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("products")
        .update(patch)
        .eq("slug", e.slug);
      if (error) {
        console.error(`      ✗ update: ${error.message}`);
        continue;
      }
    }

    const { data: prod } = await supabase
      .from("products")
      .select("id, name, brand")
      .eq("slug", e.slug)
      .single();
    if (!prod) continue;
    const id = (prod as { id: string }).id;
    const alt = `${(prod as { brand: string }).brand} ${(prod as { name: string }).name}`;

    if (e.customTags?.length) {
      const ids = e.customTags
        .map((t) => tagIdBySlug.get(t))
        .filter((v): v is string => Boolean(v));
      await supabase.from("product_custom_tags").delete().eq("product_id", id);
      if (ids.length)
        await supabase
          .from("product_custom_tags")
          .insert(ids.map((tag_id) => ({ product_id: id, tag_id })));
    }

    if (e.imageUrl && !keepImages) {
      const img = await fetchImage(e.imageUrl);
      if (!img) {
        failedImages.push(e.slug);
      } else {
        const objectPath = `products/${e.slug}/${randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(objectPath, img.data, {
            contentType: "image/webp",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upErr) {
          console.error(`      ✗ upload: ${upErr.message}`);
          failedImages.push(e.slug);
        } else {
          const base = url!.replace(/\/+$/, "");
          const publicUrl = `${base}/storage/v1/object/public/${BUCKET}/${objectPath}`;
          // Exactly one picture per product: drop whatever was there first.
          await supabase.from("product_images").delete().eq("product_id", id);
          const { error: iErr } = await supabase.from("product_images").insert({
            product_id: id,
            url: publicUrl,
            alt,
            sort_order: 0,
            is_visible: true,
          });
          if (iErr) {
            console.error(`      ✗ gallery row: ${iErr.message}`);
            failedImages.push(e.slug);
          } else {
            imaged++;
            const white = img.corner >= WHITE_LUMA;
            if (!white) greyBackgrounds.push(`${e.slug} (${img.corner})`);
            console.log(
              `      ✓ зураг ${img.width}×${img.height} · ` +
                `${Math.round(img.data.length / 1024)}KB · ` +
                `дэвсгэр ${white ? "цагаан" : `ЦАГААН БИШ (${img.corner}/255)`}`,
            );
          }
        }
      }
    }
    ok++;
  }

  console.log(`\nДууслаа: ${ok}/${entries.length} бараа, ${imaged} зураг.`);
  if (failedImages.length)
    console.log(
      `⚠︎ зураг ороогүй (${failedImages.length}): ${failedImages.join(", ")}`,
    );
  if (greyBackgrounds.length)
    console.log(
      `⚠︎ дэвсгэр цагаан биш (${greyBackgrounds.length}): ${greyBackgrounds.join(", ")}`,
    );
}

main().catch((e) => {
  console.error("\nАмжилтгүй:", e.message ?? e);
  process.exit(1);
});
