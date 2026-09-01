/**
 * Point every brand row at the logo file sitting in public/brands.
 *
 *   node --env-file=.env --import tsx scripts/set-brand-logos.ts --dry
 *   node --env-file=.env --import tsx scripts/set-brand-logos.ts
 *
 * The files are matched by slug — `public/brands/<slug>.svg` or `.png` — which
 * is the same convention the folder already used, so re-running after adding
 * one file picks it up and leaves everything else alone.
 *
 * `logo_url` is stored as a site-relative path (`/brands/dior.svg`) rather than
 * an absolute URL: the artwork is committed to the repo, so it deploys with the
 * app, needs no CDN allowlist entry, and keeps working on a preview deployment
 * where the production hostname would not.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DIR = "public/brands";
const dryRun = process.argv.includes("--dry");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

function logoFor(slug: string): string | null {
  for (const ext of ["svg", "png", "webp"]) {
    if (fs.existsSync(path.join(DIR, `${slug}.${ext}`)))
      return `/brands/${slug}.${ext}`;
  }
  return null;
}

async function main() {
  const { data, error } = await sb
    .from("brands")
    .select("id, slug, name, logo_url")
    .order("name");
  if (error) throw error;
  const brands = (data ?? []) as {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
  }[];

  let changed = 0;
  const without: string[] = [];

  for (const b of brands) {
    const file = logoFor(b.slug);
    if (!file) {
      without.push(b.slug);
      continue;
    }
    if (b.logo_url === file) continue;
    if (!dryRun) {
      const { error: e } = await sb
        .from("brands")
        .update({ logo_url: file })
        .eq("id", b.id);
      if (e) {
        console.error(`  ✗ ${b.slug}: ${e.message}`);
        continue;
      }
    }
    changed++;
    console.log(`  ${dryRun ? "→" : "✓"} ${b.slug.padEnd(28)} ${file}`);
  }

  console.log(
    `\n${brands.length} брэнд · ${changed} шинэчлэв · ${brands.length - without.length} логотой`,
  );
  if (without.length) console.log(`логогүй: ${without.join(" ")}`);
  if (dryRun) console.log("(--dry — DB хөндөөгүй)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
