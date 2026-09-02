/**
 * Give every product a second gallery image: its own bottle with the
 * fragrance's raw ingredients floating behind it, on a pure black backdrop.
 *
 *   node --env-file=.env --import tsx scripts/gen-note-images.ts --dry
 *   node --env-file=.env --import tsx scripts/gen-note-images.ts
 *   node --env-file=.env --import tsx scripts/gen-note-images.ts --rollback
 *
 * The reference is the product's **current main image** (`sort_order` 0), sent
 * back through gpt-image-1.5 as an image-to-image edit, so the bottle in the
 * result is the bottle the shop actually sells rather than an invented one.
 *
 * **This spends money** — one paid generation per product — so nothing happens
 * implicitly: `--dry` prints the plan and the notes each product would get,
 * `--limit=N` runs a sample, and bare slugs run just those products.
 *
 * A product already recorded in the manifest is skipped, so an interrupted run
 * resumes where it stopped instead of paying twice and leaving the first half
 * of the catalogue with two note images. `--force` redoes one anyway.
 *
 * Unlike `regen-product-images.ts`, which rewrites the main packshot in place,
 * this **adds** a row: the catalogue card keeps the clean packshot and the new
 * picture appears after it in the gallery. That makes the undo trivial — the
 * inserted rows are recorded in `docs/import/enrichment/note-images.json` and
 * `--rollback` deletes exactly those, leaving the original catalogue untouched.
 *
 * The scene is lit for black rather than cut out of white: a bottle shot in a
 * blacked-out studio carries rim light and dark reflections that belong there,
 * where a white-lit bottle pasted onto black reads flat and stuck-on. What the
 * model will not do is land on an exact #000000 — it returns #0A0A0A and a
 * faint vignette — so the black point is pulled down afterwards (`BLACK_POINT`)
 * and the frame edge is measured to prove it (`MAX_BACKDROP_LUMA`).
 *
 * Requires OPENAI_API_KEY + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import * as fs from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { pickNotes } from "@/lib/ai/notes-en";
import {
  MAX_NOTES,
  buildNoteImagePrompt,
  finishNoteImage,
} from "@/lib/ai/note-image";

const MANIFEST = "docs/import/enrichment/note-images.json";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";
const MODEL = "gpt-image-1.5";
const SIZE = "1024x1024";
const QUALITY = process.env.IMAGE_QUALITY ?? "high";

/**
 * Requests in flight. Same ceiling as regen-product-images: the account's image
 * quota is metered in input images per minute (this org: 5), and going over it
 * only converts work into 429s. 4 leaves room for retries to land.
 */
const CONCURRENCY = Number(
  process.argv.find((a) => a.startsWith("--concurrency="))?.slice(14) ?? 4,
);

const dryRun = process.argv.includes("--dry");
const rollback = process.argv.includes("--rollback");
/** Redo a product that the manifest already records. */
const force = process.argv.includes("--force");
const limit = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0,
);
const onlySlugs = new Set(
  process.argv.slice(2).filter((a) => !a.startsWith("--")),
);


const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!openaiKey && !dryRun && !rollback) {
  console.error("Missing OPENAI_API_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  /** The current main image, used as the edit reference. */
  refUrl: string;
  /** Where the new row goes: after every image the product already has. */
  nextSort: number;
  notes: string[];
}

interface OpenAiImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

/** One inserted row, enough to undo it. */
interface Entry {
  slug: string;
  imageId: string;
  objectPath: string;
}

async function loadProducts(): Promise<Product[]> {
  const { data, error } = await sb
    .from("products")
    .select(
      "id, slug, name, brand, notes_top, notes_heart, notes_base, product_images ( url, sort_order )",
    )
    .order("slug");
  if (error) throw error;

  const out: Product[] = [];
  for (const p of (data ?? []) as unknown as {
    id: string;
    slug: string;
    name: string;
    brand: string;
    notes_top: string[];
    notes_heart: string[];
    notes_base: string[];
    product_images: { url: string; sort_order: number }[];
  }[]) {
    if (onlySlugs.size && !onlySlugs.has(p.slug)) continue;
    const images = [...(p.product_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    if (!images.length) {
      console.error(`  ⚠ ${p.slug}: зураггүй тул алгасав`);
      continue;
    }
    const notes = pickNotes(
      { top: p.notes_top, heart: p.notes_heart, base: p.notes_base },
      MAX_NOTES,
    );
    if (!notes.length) {
      console.error(`  ⚠ ${p.slug}: зурагдах нот алга тул алгасав`);
      continue;
    }
    out.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      refUrl: images[0].url,
      nextSort: Math.max(...images.map((i) => i.sort_order)) + 1,
      notes,
    });
  }
  // Already done in an earlier run? Skip it. A 75-product paid run is worth
  // resuming rather than restarting: without this, a run interrupted at 60
  // would give the first 60 products a *second* note image and bill for it
  // again. `--force` is the escape hatch for deliberately redoing one.
  const already = new Set(readManifest().map((e) => e.slug));
  const fresh = force ? out : out.filter((p) => !already.has(p.slug));
  const skipped = out.length - fresh.length;
  if (skipped) console.log(`${skipped} бараа өмнө нь хийгдсэн тул алгаслаа.`);

  return limit > 0 ? fresh.slice(0, limit) : fresh;
}

/**
 * One image-to-image edit. Retries a rate limit or a transient 5xx; a refusal
 * or a bad request is returned as an error rather than retried, because those
 * do not get better by asking again.
 */
async function generate(ref: Buffer, prompt: string): Promise<Buffer> {
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const form = new FormData();
    form.append("model", MODEL);
    form.append(
      "image",
      new Blob([new Uint8Array(ref)], { type: "image/png" }),
      "reference.png",
    );
    form.append("prompt", prompt);
    form.append("size", SIZE);
    form.append("quality", QUALITY);
    form.append("n", "1");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
      signal: AbortSignal.timeout(600_000),
    });
    const json = (await res
      .json()
      .catch(() => null)) as OpenAiImageResponse | null;

    if (res.ok && json?.data?.[0]?.b64_json) {
      return Buffer.from(json.data[0].b64_json, "base64");
    }
    lastError = json?.error?.message || `HTTP ${res.status}`;
    // An exhausted balance arrives as a 429 like a rate limit does, but waiting
    // cannot fix it: without this the script sits through three backoffs — six
    // and a half minutes — for every product before admitting the account is
    // simply out of credits.
    const outOfCredits = /no credits|insufficient_quota|billing/i.test(lastError);
    const retryable = !outOfCredits && (res.status === 429 || res.status >= 500);
    if (!retryable) break;
    // The quota is per minute, so a retry has to clear the current window to be
    // worth anything: back off in whole minutes rather than seconds.
    await new Promise((r) => setTimeout(r, 65_000 * (attempt + 1)));
  }
  throw new Error(lastError);
}

async function runOne(p: Product): Promise<{ luma: number; entry: Entry }> {
  const refRes = await fetch(p.refUrl, { signal: AbortSignal.timeout(60_000) });
  if (!refRes.ok) throw new Error(`лавлах зураг татагдсангүй (${refRes.status})`);

  // Normalise to PNG: the gallery stores WebP, and sending the reference back
  // as PNG keeps the upload acceptable to the endpoint whatever we stored.
  const refPng = await sharp(Buffer.from(await refRes.arrayBuffer()))
    .png()
    .toBuffer();

  const raw = await generate(refPng, buildNoteImagePrompt(p.notes));
  const { webp, luma } = await finishNoteImage(raw);

  const objectPath = `products/${p.slug}/${randomUUID()}.webp`;
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(objectPath, webp, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "31536000",
    });
  if (upErr) throw new Error(`upload: ${upErr.message}`);

  const publicUrl = `${url!.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${objectPath}`;

  const { data: row, error: dbErr } = await sb
    .from("product_images")
    .insert({
      product_id: p.id,
      url: publicUrl,
      alt: `${p.brand} ${p.name} — үнэрийн нот`,
      sort_order: p.nextSort,
      is_visible: true,
    })
    .select("id")
    .single();
  if (dbErr) throw new Error(`db: ${dbErr.message}`);

  return {
    luma,
    entry: { slug: p.slug, imageId: row!.id, objectPath },
  };
}

/** Run `items` with at most `CONCURRENCY` in flight. */
async function pool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i]);
      }
    },
  );
  await Promise.all(runners);
}

function readManifest(): Entry[] {
  return fs.existsSync(MANIFEST)
    ? (JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Entry[])
    : [];
}

function writeManifest(entries: Entry[]) {
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      [...entries].sort((a, b) => a.slug.localeCompare(b.slug)),
      null,
      2,
    ) + "\n",
  );
}

/**
 * Undo: delete the rows this script inserted, then their storage objects.
 *
 * Rows first — an orphaned object costs a few kilobytes, but a row pointing at
 * a deleted object is a broken image in the shop.
 */
async function doRollback() {
  const entries = readManifest();
  if (!entries.length) {
    console.error(`${MANIFEST} хоосон — буцаах зүйл алга.`);
    process.exit(1);
  }
  let ok = 0;
  const kept: Entry[] = [];
  for (const e of entries) {
    const { error } = await sb
      .from("product_images")
      .delete()
      .eq("id", e.imageId);
    if (error) {
      console.error(`  ✗ ${e.slug}: ${error.message}`);
      kept.push(e);
      continue;
    }
    await sb.storage.from(BUCKET).remove([e.objectPath]);
    ok++;
  }
  writeManifest(kept);
  console.log(`Буцаалаа: ${ok}/${entries.length}`);
}

async function main() {
  if (rollback) return doRollback();

  const products = await loadProducts();
  if (!products.length) {
    console.log("Ажиллах бүтээгдэхүүн алга.");
    return;
  }
  console.log(
    `${products.length} бараа · ${MODEL} · ${SIZE} · quality=${QUALITY} · зэрэг ${CONCURRENCY}`,
  );

  if (dryRun) {
    for (const p of products) {
      console.log(`  • ${p.slug.padEnd(38)} sort_order ${p.nextSort}`);
      console.log(`      нот: ${p.notes.join(", ")}`);
    }
    console.log(
      `\n${products.length} зураг үүсгэнэ (төлбөртэй), тус бүр 2 дахь зураг болж нэмэгдэнэ.`,
    );
    console.log("--dry-г хасаж ажиллуул.");
    return;
  }

  const entries = readManifest();
  const failed: string[] = [];
  let done = 0;
  const started = Date.now();

  await pool(products, async (p) => {
    try {
      const { luma, entry } = await runOne(p);
      entries.push(entry);
      // Written after every success, not at the end: a run interrupted halfway
      // must still be undoable.
      writeManifest(entries);
      done++;
      console.log(
        `  ✓ ${String(done).padStart(2)}/${products.length} ${p.slug.padEnd(40)} дэвсгэр ${luma.toFixed(1)}/255`,
      );
    } catch (e) {
      failed.push(`${p.slug}: ${(e as Error).message}`);
      console.error(`  ✗ ${p.slug}: ${(e as Error).message}`);
    }
  });

  const mins = ((Date.now() - started) / 60_000).toFixed(1);
  console.log(`\nДууслаа: ${done}/${products.length} (${mins} мин).`);
  if (failed.length) {
    console.log(`Алдаа (${failed.length}):`);
    failed.forEach((f) => console.log("  • " + f));
    console.log("Дахин ажиллуулахдаа тухайн slug-уудыг аргумент болгон өг.");
  }
  console.log(`Буцаах бол: pnpm db:gen-note-images --rollback`);
}

main().catch((e) => {
  console.error("\nАмжилтгүй:", e.message ?? e);
  process.exit(1);
});
