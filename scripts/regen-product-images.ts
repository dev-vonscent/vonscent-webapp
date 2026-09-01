/**
 * Re-shoot every product photo with OpenAI, using the picture already in the
 * gallery as the reference.
 *
 *   pnpm db:regen-images --dry            # what would run, no API calls
 *   pnpm db:regen-images --limit=1        # one product, to eyeball first
 *   pnpm db:regen-images                  # all of them
 *   pnpm db:regen-images --rollback       # put the previous pictures back
 *
 * The catalogue's photos come from several sources and do not share a look —
 * different crops, different framing, different amounts of empty space. This
 * pass sends each one back through gpt-image-1.5 as an image-to-image edit with
 * one fixed prompt, so the bottles come out on one background, at one scale,
 * lit the same way.
 *
 * **This spends money** — one paid image generation per product — so it asks
 * for nothing implicitly: `--dry` prints the plan, `--limit` runs a sample.
 *
 * Every replaced URL is written to `docs/import/enrichment/image-backup.json`
 * before anything changes, and the old objects are left in the bucket rather
 * than deleted, so `--rollback` is a real undo and not a re-download.
 *
 * Requires OPENAI_API_KEY + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import * as fs from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { backgroundLuma } from "./lib/image-checks";

const BACKUP = "docs/import/enrichment/image-backup.json";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";
const MODEL = "gpt-image-1.5";
const SIZE = "1024x1024";
const QUALITY = process.env.IMAGE_QUALITY ?? "high";
/**
 * Requests in flight.
 *
 * The work is latency-bound — a generation takes tens of seconds — so running
 * them concurrently is the difference between minutes and an hour. The ceiling
 * is not CPU but the account's image quota, which is metered in **input images
 * per minute** (this org: 5). Going above it does not go faster: every request
 * over the line comes back 429 and burns retry budget, and a product whose
 * retries all land inside the same busy minute fails outright. 4 leaves room
 * for the retries themselves to get through.
 */
const CONCURRENCY = Number(
  process.argv.find((a) => a.startsWith("--concurrency="))?.slice(14) ?? 4,
);

/** The art direction, applied identically to every bottle. */
const PROMPT = `Keep the perfume bottle 100% identical to the reference image. Do not alter, redesign, retouch, crop, or reinterpret any part of the bottle. Preserve its exact shape, proportions, cap, glass, liquid color, label, logo, typography, text, reflections, and all original details. Place the bottle upright and perfectly centered on a seamless warm light-gray studio tabletop/background in #E7E5E2. No visible horizon line, no texture, no props, and no extra objects. Strict composition requirement: the complete visible bottle height must be exactly 60% of the total image height and must never exceed 60%. Keep equal empty space above and below the bottle. Do not zoom in and do not crop any part of the bottle. Use soft diffused studio lighting from the upper-left/front-left. Create a subtle, close-to-object soft shadow exactly like a premium studio product photo: the shadow should fall gently behind the bottle toward the right and bottom-right, with the darkest area close to the bottle's right edge and base. The shadow must be wide, soft, feathered, and smoothly faded into the background, with no hard edges, no sharp silhouette, no long cast shadow, and no dark black areas. Add a very subtle natural contact shadow directly beneath the bottle base. Minimal luxury perfume product photography, clean realistic glass reflections, high resolution, photorealistic, centered composition, 1:1 square aspect ratio.`;

const dryRun = process.argv.includes("--dry");
const rollback = process.argv.includes("--rollback");
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
  imageId: string;
  imageUrl: string;
}

interface OpenAiImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

async function loadProducts(): Promise<Product[]> {
  const { data, error } = await sb
    .from("products")
    .select("id, slug, name, brand, product_images ( id, url, sort_order )")
    .order("slug");
  if (error) throw error;
  const out: Product[] = [];
  for (const p of (data ?? []) as unknown as {
    id: string;
    slug: string;
    name: string;
    brand: string;
    product_images: { id: string; url: string; sort_order: number }[];
  }[]) {
    if (onlySlugs.size && !onlySlugs.has(p.slug)) continue;
    const img = [...(p.product_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    )[0];
    if (!img) {
      console.error(`  ⚠ ${p.slug}: зураггүй тул алгасав`);
      continue;
    }
    out.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      imageId: img.id,
      imageUrl: img.url,
    });
  }
  return limit > 0 ? out.slice(0, limit) : out;
}

/**
 * One image-to-image edit. Retries a rate limit or a transient 5xx; a refusal
 * or a bad request is returned as an error rather than retried, because those
 * do not get better by asking again.
 */
async function generate(ref: Buffer): Promise<Buffer> {
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const form = new FormData();
    form.append("model", MODEL);
    form.append(
      "image",
      new Blob([new Uint8Array(ref)], { type: "image/png" }),
      "reference.png",
    );
    form.append("prompt", PROMPT);
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
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) break;
    // The quota is per minute, so a retry has to clear the current window to
    // be worth anything: back off in whole minutes rather than seconds.
    await new Promise((r) => setTimeout(r, 65_000 * (attempt + 1)));
  }
  throw new Error(lastError);
}

async function runOne(p: Product): Promise<{ slug: string; luma: number }> {
  const refRes = await fetch(p.imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!refRes.ok) throw new Error(`лавлах зураг татагдсангүй (${refRes.status})`);
  const refBuf = Buffer.from(await refRes.arrayBuffer());

  // Normalise to PNG: the gallery stores WebP, and sending the reference back
  // as PNG keeps the upload acceptable to the endpoint whatever we stored.
  const refPng = await sharp(refBuf).png().toBuffer();

  const raw = await generate(refPng);
  const webp = await sharp(raw).webp({ quality: 82 }).toBuffer();

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

  // Update the existing gallery row in place: the product keeps exactly one
  // picture, and its row id stays stable.
  const { error: dbErr } = await sb
    .from("product_images")
    .update({ url: publicUrl, alt: `${p.brand} ${p.name}`, is_visible: true })
    .eq("id", p.imageId);
  if (dbErr) throw new Error(`db: ${dbErr.message}`);

  return { slug: p.slug, luma: await backgroundLuma(webp) };
}

/** Run `jobs` with at most `CONCURRENCY` in flight, preserving completion order. */
async function pool<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

async function doRollback() {
  if (!fs.existsSync(BACKUP)) {
    console.error(`${BACKUP} алга — буцаах зүйл алга.`);
    process.exit(1);
  }
  const rows: { slug: string; imageId: string; url: string }[] = JSON.parse(
    fs.readFileSync(BACKUP, "utf8"),
  );
  let ok = 0;
  for (const r of rows) {
    const { error } = await sb
      .from("product_images")
      .update({ url: r.url })
      .eq("id", r.imageId);
    if (error) console.error(`  ✗ ${r.slug}: ${error.message}`);
    else ok++;
  }
  console.log(`Буцаалаа: ${ok}/${rows.length}`);
}

async function main() {
  if (rollback) return doRollback();

  const products = await loadProducts();
  console.log(
    `${products.length} бараа · ${MODEL} · ${SIZE} · quality=${QUALITY} · зэрэг ${CONCURRENCY}`,
  );

  if (dryRun) {
    for (const p of products) console.log(`  • ${p.slug}  ← ${p.imageUrl.split("/").pop()}`);
    console.log(
      `\n${products.length} зураг үүсгэнэ (төлбөртэй). --dry-г хасаж ажиллуул.`,
    );
    return;
  }

  // Snapshot before anything is overwritten.
  //
  // Merged, and the *first* recorded URL for a slug wins: a second pass over a
  // product that was already regenerated would otherwise record the generated
  // picture as the "original" and quietly destroy the only way back.
  type Backup = { slug: string; imageId: string; url: string };
  const prior: Backup[] = fs.existsSync(BACKUP)
    ? JSON.parse(fs.readFileSync(BACKUP, "utf8"))
    : [];
  const bySlug = new Map<string, Backup>(prior.map((b) => [b.slug, b]));
  let added = 0;
  for (const p of products) {
    if (bySlug.has(p.slug)) continue;
    bySlug.set(p.slug, { slug: p.slug, imageId: p.imageId, url: p.imageUrl });
    added++;
  }
  fs.writeFileSync(
    BACKUP,
    JSON.stringify([...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug)), null, 2) +
      "\n",
  );
  console.log(
    `${BACKUP}: ${added} шинэ бичлэг, нийт ${bySlug.size} хуучин зураг хадгалав.\n`,
  );

  const failed: string[] = [];
  let done = 0;
  const started = Date.now();

  await pool(products, async (p) => {
    try {
      const { luma } = await runOne(p);
      done++;
      console.log(
        `  ✓ ${String(done).padStart(2)}/${products.length} ${p.slug.padEnd(44)} дэвсгэр ${luma}/255`,
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
  console.log(`Буцаах бол: pnpm db:regen-images --rollback`);
}

main().catch((e) => {
  console.error("\nАмжилтгүй:", e.message ?? e);
  process.exit(1);
});
