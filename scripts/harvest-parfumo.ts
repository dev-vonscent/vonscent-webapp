/**
 * Look up each product on Parfumo and dump what it knows about them.
 *
 *   node --import tsx scripts/harvest-parfumo.ts            # every product
 *   node --import tsx scripts/harvest-parfumo.ts <slug> …   # just these
 *
 * Research input for the enrichment manifests, written to
 * docs/import/enrichment/harvest.json. It never touches the catalogue: the
 * English notes and the picture it finds still have to be read, checked
 * against the brand's own page and rewritten in Mongolian by hand.
 *
 * Why Parfumo and not the brand sites: the houses that matter here (LVMH,
 * Kering, L'Oréal) serve a hard 403 to anything that isn't a browser, and the
 * ones that do answer publish a marketing paragraph without a note pyramid.
 * Parfumo answers, and its pyramid is real markup rather than prose, so the
 * notes come out structured instead of regex-guessed. Its catalogue thumbnail
 * is also the one packshot source that is reliably on white — which is what
 * the client asked for — where the brands' own PDP shots sit on grey studio
 * sweeps.
 *
 * Every product costs two requests (search, then the page), spaced out so this
 * stays a polite trickle rather than a scrape.
 */
import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADERS = {
  "user-agent": UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};
const OUT = "docs/import/enrichment/harvest.json";
/**
 * Gap between requests. Two per product, so this paces the whole run.
 * Parfumo starts returning 403 to a sustained trickle somewhere past fifty
 * products, so this is deliberately unhurried and `--delay=<ms>` can slow it
 * further on a retry pass.
 */
const DELAY_MS = Number(
  process.argv.find((a) => a.startsWith("--delay="))?.slice(8) ?? 1600,
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Product {
  slug: string;
  brand: string;
  name: string;
  concentration: string;
}

export interface Harvested {
  slug: string;
  brand: string;
  name: string;
  concentration: string;
  /** Parfumo page the rest of this came from. */
  pageUrl?: string;
  /** Other search hits, so a bad match is visible rather than silent. */
  alternates?: string[];
  imageUrl?: string;
  imageWhite?: boolean;
  year?: number;
  notesTop?: string[];
  notesHeart?: string[];
  notesBase?: string[];
  /** Used when the fragrance is listed without a pyramid — one flat note list. */
  notesAll?: string[];
  description?: string;
  error?: string;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .trim();
}

/**
 * Fetch with backoff. A 403 here is rate limiting rather than a real refusal —
 * the same URL answers again after a pause — so it is worth waiting out
 * instead of recording the product as unavailable.
 */
async function get(url: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return await res.text();
      if (res.status !== 403 && res.status !== 429) return null;
    } catch {
      // network hiccup — same backoff
    }
    if (i < attempts - 1) await sleep(20_000 * (i + 1));
  }
  return null;
}

/**
 * Products whose right page the scorer cannot reach, pinned by hand.
 *
 * Search only ranks what it is shown, and for these the correct entry either
 * never came back or lost to a near neighbour: «Hugo Man» is filed under a
 * different house than the query implies, «Baccarat Rouge 540» matches a hair
 * mist before the extrait, and «Acqua di Gio» / «Allure Homme Sport» each lose
 * to a flanker that spells the concentration out. Auditing the matches is part
 * of the job; this is where the audit's corrections live.
 */
const PAGE_OVERRIDES: Record<string, string> = {
  "chanel-allure-homme-sport":
    "https://www.parfumo.com/Perfumes/Chanel/Allure_Homme_Sport",
  "giorgio-armani-acqua-di-gio":
    "https://www.parfumo.com/Perfumes/Giorgio_Armani/acqua-di-gio-eau-de-parfum",
  "hugo-boss-hugo-man": "https://www.parfumo.com/Perfumes/Hugo/Hugo_Man",
  "maison-francis-kurkdjian-baccarat-rouge-540":
    "https://www.parfumo.com/Perfumes/Maison_Francis_Kurkdjian/baccarat-rouge-540-extrait-de-parfum",
};

/** Nav and listing links that share the /Perfumes/ prefix but are not products. */
const NOT_A_PRODUCT =
  /\/Perfumes\/(Tops|Trends|Dupes|New|Popular|Search|Awards)\b/i;

/**
 * Words to match on, with the trade abbreviations spelled out.
 *
 * Expanded rather than stripped, because the abbreviation is often the only
 * thing separating two products in the same family: «Sauvage edp» and
 * «Sauvage elixir» collapse to the same string once you drop concentration
 * words, and the scorer can then no longer tell Parfumo's `sauvage-elixir`
 * from its `sauvage-eau-de-parfum`.
 */
const ABBREV: Record<string, string> = {
  edp: "eau de parfum",
  edt: "eau de toilette",
  edc: "eau de cologne",
};

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .flatMap((w) => (ABBREV[w] ? ABBREV[w].split(" ") : [w]))
    .filter(Boolean);
}

/**
 * Pick the search hit whose URL slug best covers the product name.
 *
 * Scoring on shared words rather than taking the first hit matters because
 * these are dense product families: a search for «Sauvage edp» returns
 * Sauvage Elixir and Sauvage x Baccarat alongside the one we want, and the
 * first hit is not reliably the right one. Everything else is kept in
 * `alternates` so a wrong pick is caught by eye rather than shipped.
 */
/**
 * Concentration a URL slug (or a product row) is talking about, if any.
 * `undefined` means the slug does not say — very common, because a house's
 * base product usually gets the bare `/Perfumes/Chanel/Coco_Mademoiselle`
 * while only its flankers spell the concentration out.
 */
function concentrationOf(ws: string[]): string | undefined {
  const has = (...xs: string[]) => xs.every((x) => ws.includes(x));
  if (has("eau", "de", "parfum")) return "edp";
  if (has("eau", "de", "toilette")) return "edt";
  if (has("eau", "de", "cologne")) return "edc";
  if (ws.includes("elixir")) return "elixir";
  if (ws.includes("extrait")) return "extrait";
  if (ws.includes("parfum")) return "parfum";
  return undefined;
}

/**
 * Flanker markers. A candidate carrying one of these that the product did not
 * ask for is almost certainly a different release in the same family, so it is
 * penalised hard — «Coco Mademoiselle Eau de Parfum Intense» otherwise beats
 * plain «Coco Mademoiselle» purely by matching more words.
 */
const FLANKERS = [
  "intense",
  "intensely",
  "extreme",
  "absolu",
  "absolue",
  "elixir",
  "extrait",
  "essence",
  "energy",
  "flame",
  "limited",
  "edition",
  "exclusif",
];

/**
 * Pick the search hit that best identifies the product.
 *
 * These are dense product families — a search for «Sauvage» returns the EDT,
 * the EDP, the Elixir and a Baccarat collaboration — so the first hit is not
 * reliably the right one. Three things are scored: how much of the product
 * name the candidate covers, whether the concentration agrees, and whether it
 * drags in words we never asked for. Everything not chosen is kept in
 * `alternates`, so a wrong pick is caught by eye rather than shipped.
 */
function pickBest(
  links: string[],
  product: Product,
): { best?: string; alternates: string[] } {
  const nameWords = words(product.name);
  const wanted = new Set(nameWords);
  const wantConc =
    concentrationOf(nameWords) ?? concentrationOf(words(product.concentration));

  const scored = links.map((href) => {
    const tail = decodeURIComponent(href.split("/").slice(-1)[0] ?? "");
    const cand = words(tail);
    const candSet = new Set(cand);

    let score = 0;
    for (const w of wanted) if (candSet.has(w)) score += 10;

    const gotConc = concentrationOf(cand);
    if (gotConc && wantConc) score += gotConc === wantConc ? 25 : -30;
    else if (!gotConc) score += 8; // bare slug: usually the base product

    for (const w of candSet) {
      if (wanted.has(w)) continue;
      // Concentration words are already accounted for above.
      if (["eau", "de", "parfum", "toilette", "cologne"].includes(w)) continue;
      score -= FLANKERS.includes(w) ? 30 : 6;
    }
    return { href, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return {
    best: scored[0]?.href,
    alternates: scored.slice(1, 5).map((s) => s.href),
  };
}

async function search(product: Product): Promise<{ best?: string; alternates: string[] }> {
  // Parfumo's search returns nothing at all for a literal "edp"/"edt", so the
  // query goes in expanded.
  const q = encodeURIComponent(
    [...words(product.brand), ...words(product.name)].join(" "),
  );
  const html = await get(
    `https://www.parfumo.com/s_perfumes_x.php?in=1&order=&filter=${q}`,
  );
  if (!html) return { alternates: [] };
  const links = [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/www\.parfumo\.com\/Perfumes\/[^"]+)"/g)]
        .map((m) => m[1])
        // A product URL is /Perfumes/<Brand>/<name>; /Perfumes/<Brand> is the
        // brand index.
        .filter((h) => h.split("/").length >= 6 && !NOT_A_PRODUCT.test(h)),
    ),
  ];
  return pickBest(links, product);
}

function parseNotes(html: string): Pick<Harvested, "notesTop" | "notesHeart" | "notesBase" | "notesAll"> {
  const block = (kind: string): string[] => {
    const re = new RegExp(
      `pyramid_block nb_${kind}[\\s\\S]*?<div class="pt-0-5">([\\s\\S]*?)</div>`,
      "i",
    );
    const seg = html.match(re)?.[1];
    if (!seg) return [];
    return [
      ...new Set(
        [...seg.matchAll(/alt="([^"]+)"/g)].map((m) => decode(m[1])),
      ),
    ];
  };
  const top = block("t");
  // Parfumo calls the heart the "middle" block in markup while labelling it
  // "Heart Notes" on screen.
  const heart = block("m");
  const base = block("b");
  if (top.length || heart.length || base.length)
    return { notesTop: top, notesHeart: heart, notesBase: base };

  // No pyramid — Parfumo then renders one flat list in an `nb_n` block.
  const flat = html.match(/<div class="nb_n">([\s\S]*?)<\/div>/i)?.[1];
  const all = flat
    ? [...new Set([...flat.matchAll(/alt="([^"]+)"/g)].map((m) => decode(m[1])))]
    : [];
  return all.length ? { notesAll: all } : {};
}

async function harvestOne(product: Product): Promise<Harvested> {
  const out: Harvested = { ...product };
  const pinned = PAGE_OVERRIDES[product.slug];
  const { best, alternates } = pinned
    ? { best: pinned, alternates: [] }
    : await search(product);
  if (!best) {
    out.error = "Parfumo хайлтад олдсонгүй";
    return out;
  }
  out.pageUrl = best;
  if (alternates.length) out.alternates = alternates;

  await sleep(DELAY_MS);
  const html = await get(best);
  if (!html) {
    out.error = "хуудас татагдсангүй";
    return out;
  }

  Object.assign(out, parseNotes(html));

  const year = html.match(/\b(?:19|20)\d\d\b/g);
  const titleYear = html
    .match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    ?.match(/\b((?:19|20)\d\d)\b/)?.[1];
  out.year = Number(titleYear ?? year?.[0]) || undefined;

  const desc = html.match(
    /<meta[^>]+name="description"[^>]+content="([^"]*)"/i,
  )?.[1];
  if (desc) out.description = decode(desc);

  // The catalogue thumbnail: white background, no watermark. The `_1200`
  // original is what the width-suffixed variants are cropped from.
  const img = [
    ...new Set(
      [...html.matchAll(/https:\/\/media\.parfumo\.com\/perfumes\/[^"')\s]+/g)].map(
        (m) => m[0].split("?")[0],
      ),
    ),
  ];
  // The page also lists sibling fragrances in a "you might also like" rail, so
  // the picture for *this* page is the one whose filename covers every word of
  // the page's own URL slug.
  const wantWords = words(best.split("/").slice(-1)[0]);
  out.imageUrl =
    img.find((u) => {
      const file = words(
        u.split("/").slice(-1)[0].replace(/_\d+\.jpg$/, ""),
      );
      return wantWords.every((w) => file.includes(w));
    }) ?? img[0];

  return out;
}

async function main() {
  const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--")));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env.");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb
    .from("products")
    .select("slug, brand, name, concentration")
    .order("slug");
  const products = (data ?? []).filter(
    (p: Product) => !only.size || only.has(p.slug),
  ) as Product[];

  console.log(`${products.length} бараа — Parfumo-оос мэдээлэл цуглуулж байна…`);
  const results: Harvested[] = [];
  for (const [i, p] of products.entries()) {
    const r = await harvestOne(p);
    results.push(r);
    const notes =
      (r.notesTop?.length ?? 0) +
      (r.notesHeart?.length ?? 0) +
      (r.notesBase?.length ?? 0) +
      (r.notesAll?.length ?? 0);
    console.log(
      `  ${String(i + 1).padStart(2)}/${products.length} ${p.slug.padEnd(44)} ` +
        `${r.error ? "✗ " + r.error : `${notes} нот · ${r.year ?? "он?"} · ${r.imageUrl ? "зураг" : "ЗУРАГГҮЙ"}`}`,
    );
    await sleep(DELAY_MS);
  }

  // Merge rather than overwrite: a retry pass is normally a handful of slugs,
  // and clobbering the file would throw away everything the first pass got.
  let merged: Harvested[] = results;
  if (fs.existsSync(OUT)) {
    const prev: Harvested[] = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const bySlug = new Map(prev.map((r) => [r.slug, r]));
    for (const r of results) bySlug.set(r.slug, r);
    merged = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  const missing = merged.filter((r) => !r.imageUrl);
  const noNotes = merged.filter((r) => !r.notesTop?.length && !r.notesAll?.length);
  console.log(
    `\n${OUT}: нийт ${merged.length}. Зураггүй ${missing.length}, нотгүй ${noNotes.length}.`,
  );
  if (missing.length)
    console.log("  дутуу: " + missing.map((r) => r.slug).join(" "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
