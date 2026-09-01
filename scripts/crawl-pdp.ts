/**
 * Pull the structured product data out of an official product page.
 *
 *   node --import tsx scripts/crawl-pdp.ts <url> [<url> …]
 *
 * A research aid for building the enrichment manifests that
 * scripts/enrich-products.ts consumes — it does not touch the database.
 *
 * Brand sites are near-universally bot-hostile to a bare client but let a
 * request through that looks like a real browser, so every fetch carries the
 * full Chrome header set. What comes back is read three ways, in decreasing
 * order of trust: JSON-LD `Product` (schema.org — the brand's own machine
 * description of the item), OpenGraph tags, then the raw text for a notes
 * pyramid. Whatever is found is printed as JSON for the researcher to fold
 * into a manifest by hand; nothing here writes copy on its own.
 *
 * With `--images` each candidate picture is also downloaded and measured, so
 * the "is the background white" question the client asked is answered before a
 * URL goes anywhere near a manifest rather than after the upload.
 */
import sharp from "sharp";
import { WHITE_LUMA, backgroundLuma } from "./lib/image-checks";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "user-agent": UA,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "upgrade-insecure-requests": "1",
};

interface ImageProbe {
  url: string;
  status: number;
  width?: number;
  height?: number;
  /** Border-ring median luminance 0-255; >= 244 reads as a white background. */
  corner?: number;
  white?: boolean;
  kb?: number;
}

interface Extracted {
  url: string;
  status: number;
  title?: string;
  description?: string;
  images: string[];
  probes?: ImageProbe[];
  brand?: string;
  notes?: Record<string, string>;
  error?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&eacute;/g, "é")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, prop: string): string | undefined {
  // property= and name= both occur; attribute order varies by CMS.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : undefined;
}

/** Every JSON-LD block on the page, flattened through @graph. */
function jsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        out.push(it);
        const graph = (it as { "@graph"?: unknown[] })["@graph"];
        if (Array.isArray(graph)) out.push(...graph);
      }
    } catch {
      // Half the web ships malformed JSON-LD; skip and fall back to OG tags.
    }
  }
  return out;
}

function isProduct(x: unknown): x is Record<string, unknown> {
  const t = (x as { "@type"?: unknown })?.["@type"];
  return Array.isArray(t) ? t.includes("Product") : t === "Product";
}

/**
 * A notes pyramid, when the page spells one out. Brands write it a dozen ways
 * ("Top notes:", "HEAD NOTES —", "Notes de tête"), so this stays deliberately
 * loose and the result is treated as a hint, not as data.
 */
function notes(text: string): Record<string, string> | undefined {
  const patterns: [string, RegExp][] = [
    ["top", /(?:top|head|opening)\s*notes?\s*[:\-–—]\s*([^.|\n]{3,160})/i],
    ["heart", /(?:heart|middle|mid)\s*notes?\s*[:\-–—]\s*([^.|\n]{3,160})/i],
    ["base", /(?:base|dry\s*down|bottom)\s*notes?\s*[:\-–—]\s*([^.|\n]{3,160})/i],
  ];
  const found: Record<string, string> = {};
  for (const [k, re] of patterns) {
    const m = text.match(re);
    if (m) found[k] = m[1].trim();
  }
  return Object.keys(found).length ? found : undefined;
}

async function crawl(url: string): Promise<Extracted> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { url, status: 0, images: [], error: (e as Error).message };
  }
  if (!res.ok) return { url, status: res.status, images: [] };

  const html = await res.text();
  const product = jsonLd(html).find(isProduct);

  const images = new Set<string>();
  const ogImage = meta(html, "og:image");
  if (ogImage) images.add(ogImage);
  if (product) {
    const img = product.image;
    for (const i of Array.isArray(img) ? img : [img])
      if (typeof i === "string") images.add(i);
      else if (i && typeof i === "object" && "url" in i)
        images.add(String((i as { url: unknown }).url));
  }

  const ldDesc = product?.description;
  const description =
    (typeof ldDesc === "string" ? stripTags(ldDesc) : undefined) ??
    meta(html, "og:description") ??
    meta(html, "description");

  const brandRaw = product?.brand;
  const brand =
    typeof brandRaw === "string"
      ? brandRaw
      : brandRaw && typeof brandRaw === "object" && "name" in brandRaw
        ? String((brandRaw as { name: unknown }).name)
        : undefined;

  return {
    url,
    status: res.status,
    title:
      (typeof product?.name === "string" ? product.name : undefined) ??
      meta(html, "og:title") ??
      stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description,
    images: [...images].map((i) => (i.startsWith("//") ? "https:" + i : i)),
    brand,
    notes: notes(stripTags(html).slice(0, 200_000)),
  };
}

/** Download a candidate picture and measure its size and corner colour. */
async function probeImage(src: string): Promise<ImageProbe> {
  try {
    const res = await fetch(src, {
      headers: { ...HEADERS, accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { url: src, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const corner = await backgroundLuma(buf);
    return {
      url: src,
      status: res.status,
      width: meta.width,
      height: meta.height,
      corner,
      white: corner >= WHITE_LUMA,
      kb: Math.round(buf.length / 1024),
    };
  } catch {
    return { url: src, status: 0 };
  }
}

async function main() {
  const withImages = process.argv.includes("--images");
  const urls = process.argv.slice(2).filter((a) => a !== "--images");
  if (!urls.length) {
    console.error("Usage: node --import tsx scripts/crawl-pdp.ts <url> …");
    process.exit(1);
  }
  const results = await Promise.all(urls.map(crawl));
  if (withImages)
    for (const r of results)
      r.probes = await Promise.all(r.images.slice(0, 4).map(probeImage));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
