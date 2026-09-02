/**
 * Find an SVG wordmark for every brand that hasn't got one yet.
 *
 *   node --env-file=.env --import tsx scripts/fetch-brand-logos.ts --review
 *   node --env-file=.env --import tsx scripts/fetch-brand-logos.ts --write
 *
 * `--review` downloads the candidates and renders a contact sheet to
 * /tmp/brand-logos.png so a human can see what would be saved; `--write` saves
 * the chosen file to public/brands/<slug>.svg. Nothing touches the database —
 * scripts/set-brand-logos.ts does that once the files are on disk.
 *
 * Source is Wikimedia Commons: it is the one logo archive that answers a
 * scripted request, and its files are SVG wordmarks on transparent
 * backgrounds, which is exactly the shape /public/brands already holds (dark
 * artwork the `.brand-logo` class inverts on the dark theme).
 *
 * Picking is scored, not first-hit: a search for «Versace» offers the current
 * wordmark next to a 1970s revival and a group holding logo, and the ranking
 * Commons returns is not the one we want. `PINNED` overrides the scorer for
 * the brands where it still guesses wrong.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const OUT_DIR = "public/brands";
const SHEET = "/tmp/brand-logos.png";
const UA =
  "vonscent-logo-fetch/1.0 (https://vonscent.mn; dev.vonscent.store@gmail.com)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const review = process.argv.includes("--review");
const write = process.argv.includes("--write");
const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));

/**
 * Exact Commons file titles for brands where the search ranking is wrong.
 * Filled in from the `--review` sheet — «Hermès logo» ranks a Cypriot airport
 * operator and a German abrasives maker above the fashion house.
 */
const PINNED: Record<string, string> = {
  hermes: "File:Hermes wordmark.svg",
};

/**
 * Brands Commons simply does not carry — niche houses with no encyclopaedia
 * article — taken from their own site's header instead. PNG is fine: the
 * artwork is black on transparent, which is all `.brand-logo` needs to invert
 * it on the dark theme.
 */
const DIRECT: Record<string, string> = {
  // On Commons but filed under the English Wikipedia's name for it, which the
  // Commons file search does not turn up.
  azzaro: "https://upload.wikimedia.org/wikipedia/commons/4/40/Logo_Azzaro.png",
  byredo: "https://www.byredo.com/images/byredo-logo.svg",
  "le-labo": "https://www.lelabofragrances.com/css/images/logonew.png",
  "parfums-de-marly":
    "https://parfums-de-marly.com/cdn/shop/files/PDM_Paris_logo_text_black_RGB_BaB_HD.png?v=1728904362&width=600",
};

/**
 * Brands neither Commons nor a plain `DIRECT` fetch reaches, saved by hand.
 * Recorded here so a later run knows the file on disk was deliberate rather
 * than left over from a broken fetch:
 *
 * - `diptyque` — the wordmark is an inline `<symbol id="i-logo">` in the
 *   diptyqueparis.com header sprite, not a file, so it was lifted out of the
 *   page and wrapped in its own `<svg>` with the clipPath it references.
 * - `maison-francis-kurkdjian` — franciskurkdjian.com is behind Akamai and
 *   answers a scripted request with 403, so the mark came from seeklogo
 *   (625488) as gold-on-white and was re-cut to black on transparent.
 */

/**
 * Brands that are a line of another house rather than a house of their own,
 * and so share its mark. Miss Dior is Dior.
 */
const ALIAS: Record<string, string> = {
  "miss-dior": "dior",
};

/** Titles that are the wrong artwork even when they rank first. */
const REJECT =
  /\b(old|former|19\d\d|20[01]\d|group|holding|beauty|parfums? de|store|shop|building|sign|font|typeface|monogram|crest|emblem|pattern|icon|symbol|s\.p\.a|spa)\b/i;

interface Candidate {
  title: string;
  url: string;
  score: number;
}

async function api(params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ format: "json", origin: "*", ...params });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs}`, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
  return res.json();
}

function scoreTitle(title: string, brand: string): number {
  const t = title.replace(/^File:/, "").replace(/\.svg$/i, "");
  const lower = t.toLowerCase();
  const b = brand.toLowerCase();
  let score = 0;
  if (lower === `${b} logo`) score += 100;
  if (lower === `${b}-logo`) score += 100;
  if (lower === b) score += 80;
  if (lower.startsWith(b)) score += 40;
  if (lower.includes("logo")) score += 20;
  if (lower.includes("wordmark") || lower.includes("text")) score += 10;
  if (REJECT.test(lower)) score -= 120;
  // Shorter titles are usually the plain current mark.
  score -= t.length / 10;
  return score;
}

async function search(brand: string): Promise<Candidate[]> {
  const data = (await api({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: `${brand} logo filetype:drawing`,
    prop: "imageinfo",
    iiprop: "url|mime",
  })) as {
    query?: {
      pages?: Record<
        string,
        { title: string; imageinfo?: { url: string; mime: string }[] }
      >;
    };
  };
  const pages = Object.values(data.query?.pages ?? {});
  return pages
    .filter((p) => p.imageinfo?.[0]?.mime === "image/svg+xml")
    .map((p) => ({
      title: p.title,
      url: p.imageinfo![0].url.split("?")[0],
      score: scoreTitle(p.title, brand),
    }))
    .sort((a, b) => b.score - a.score);
}

async function fetchByTitle(title: string): Promise<Candidate | null> {
  const data = (await api({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|mime",
  })) as {
    query?: {
      pages?: Record<
        string,
        { title: string; imageinfo?: { url: string; mime: string }[] }
      >;
    };
  };
  const p = Object.values(data.query?.pages ?? {})[0];
  const info = p?.imageinfo?.[0];
  if (!info || info.mime !== "image/svg+xml") return null;
  return { title: p.title, url: info.url.split("?")[0], score: 999 };
}

/** Downloaded artwork plus the extension it should be saved under. */
interface Logo {
  data: Buffer;
  ext: "svg" | "png";
}

async function download(url: string): Promise<Logo | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Commons wants a descriptive agent; brand CDNs want a browser one.
        "user-agent": url.includes("wikimedia.org") ? UA : BROWSER_UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    const head = data.subarray(0, 400).toString("utf8");
    if (/<svg|<\?xml/i.test(head)) return { data, ext: "svg" };
    // PNG magic number — anything else (an HTML error page, a JPEG on a white
    // box) is not usable as a transparent logo.
    if (data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
      return { data, ext: "png" };
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env.");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.from("brands").select("slug, name").order("name");
  const brands = ((data ?? []) as { slug: string; name: string }[]).filter(
    (b) => !only.size || only.has(b.slug),
  );

  /** The logo already on disk for a slug, in either format. */
  const existing = (slug: string): string | null =>
    (["svg", "png"] as const)
      .map((ext) => path.join(OUT_DIR, `${slug}.${ext}`))
      .find((f) => fs.existsSync(f)) ?? null;

  const missing = brands.filter((b) => !existing(b.slug));
  console.log(
    `${brands.length} брэнд · ${brands.length - missing.length} лого байна · ${missing.length} дутуу`,
  );
  if (!missing.length) return;

  const tiles: { name: string; png: Buffer }[] = [];
  const failed: string[] = [];

  for (const b of missing) {
    let saved: { title: string; logo: Logo } | null = null;

    const aliasOf = ALIAS[b.slug];
    const direct = DIRECT[b.slug];
    const pinned = PINNED[b.slug];

    if (aliasOf) {
      // Copy the parent house's mark rather than fetching a second time.
      const src = existing(aliasOf);
      if (src) {
        saved = {
          title: `alias → ${path.basename(src)}`,
          logo: {
            data: fs.readFileSync(src),
            ext: src.endsWith(".png") ? "png" : "svg",
          },
        };
      }
    } else if (direct) {
      const logo = await download(direct);
      if (logo) saved = { title: new URL(direct).hostname, logo };
    } else {
      const cands = pinned
        ? ([await fetchByTitle(pinned)].filter(Boolean) as Candidate[])
        : await search(b.name);
      for (const c of cands.slice(0, 3)) {
        const logo = await download(c.url);
        if (!logo) continue;
        saved = { title: c.title, logo };
        break;
      }
    }

    if (!saved) {
      failed.push(b.slug);
      console.log(`  ✗ ${b.slug}`);
      continue;
    }
    const file = `${b.slug}.${saved.logo.ext}`;
    console.log(
      `  ✓ ${file.padEnd(32)} ${saved.title.replace("File:", "")}`,
    );

    if (write) fs.writeFileSync(path.join(OUT_DIR, file), saved.logo.data);
    if (review) {
      try {
        // Black-on-transparent artwork: flatten onto white so it is visible.
        // `limitInputPixels` is off because some Commons SVGs declare an
        // enormous viewBox (Valentino's is 19629pt) that a browser renders
        // without complaint but sharp's default guard refuses.
        const png = await sharp(saved.logo.data, {
          density: 96,
          limitInputPixels: false,
        })
          .resize(300, 110, { fit: "contain", background: "#ffffff" })
          .flatten({ background: "#ffffff" })
          .png()
          .toBuffer();
        tiles.push({ name: b.slug, png });
      } catch {
        console.log(`     (rasterise боломжгүй — гараар шалга)`);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (review && tiles.length) {
    const cols = 4;
    const rows = Math.ceil(tiles.length / cols);
    await sharp({
      create: {
        width: 300 * cols,
        height: 110 * rows,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite(
        tiles.map((t, i) => ({
          input: t.png,
          left: (i % cols) * 300,
          top: Math.floor(i / cols) * 110,
        })),
      )
      .png()
      .toFile(SHEET);
    console.log(`\n${SHEET} — дарааллаар: ${tiles.map((t) => t.name).join(", ")}`);
  }
  if (failed.length) console.log(`\nолдоогүй: ${failed.join(" ")}`);
  if (!write) console.log("\n(--write өгөөгүй тул файл бичээгүй)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
