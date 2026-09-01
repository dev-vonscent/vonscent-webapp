/**
 * Merge the hand-written Mongolian copy with the harvested facts into one
 * enrichment manifest.
 *
 *   node --import tsx scripts/build-enrichment.ts
 *
 * Two inputs, deliberately kept apart:
 *
 *   harvest.json   — machine-collected (scripts/harvest-parfumo.ts): the
 *                    picture URL, the launch year, the English note pyramid.
 *   copy.mn.json   — written by hand: the Mongolian notes and the four blocks
 *                    of description a customer reads.
 *
 * Splitting them means a re-harvest never overwrites prose, and a wording fix
 * never costs a network round trip. The output, manifest.json, is what
 * scripts/enrich-products.ts writes to the database.
 *
 * Anything in copy.mn.json wins over the harvest — the harvest is a research
 * note, the copy is the decision.
 */
import * as fs from "node:fs";

const DIR = "docs/import/enrichment";
const HARVEST = `${DIR}/harvest.json`;
const COPY = `${DIR}/copy.mn.json`;
const NOTES = `${DIR}/notes.mn.json`;
const OUT = `${DIR}/manifest.json`;

interface Harvested {
  slug: string;
  brand: string;
  name: string;
  pageUrl?: string;
  imageUrl?: string;
  year?: number;
  notesTop?: string[];
  notesHeart?: string[];
  notesBase?: string[];
  /** Fragrances Parfumo lists without a pyramid — one flat note list. */
  notesAll?: string[];
  error?: string;
}

interface Copy {
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
  /** Override the harvested picture when a better one was found by hand. */
  imageUrl?: string;
}

function main() {
  const harvest: Harvested[] = JSON.parse(fs.readFileSync(HARVEST, "utf8"));
  const copy: Record<string, Copy> = JSON.parse(fs.readFileSync(COPY, "utf8"));
  const dict: Record<string, string> = JSON.parse(fs.readFileSync(NOTES, "utf8"));
  const bySlug = new Map(harvest.map((h) => [h.slug, h]));
  const untranslated = new Set<string>();

  /**
   * English note list -> Mongolian, through the shared dictionary.
   *
   * One dictionary rather than per-product typing, because the same note
   * recurs across dozens of fragrances and the catalogue has to call it the
   * same thing every time — the storefront groups and searches on these
   * strings. A note with no entry is passed through unchanged and reported,
   * so it gets a considered translation rather than a silent guess.
   */
  const mn = (notes?: string[]): string[] | undefined => {
    if (!notes?.length) return undefined;
    return notes.map((n) => {
      const hit = dict[n];
      if (!hit) untranslated.add(n);
      return hit ?? n;
    });
  };

  const unknown = Object.keys(copy).filter((s) => !bySlug.has(s));
  if (unknown.length) {
    console.error(`harvest.json-д байхгүй slug: ${unknown.join(", ")}`);
    process.exit(1);
  }

  const entries = Object.entries(copy).map(([slug, c]) => {
    const h = bySlug.get(slug)!;
    // Hand-written notes win; otherwise the harvested pyramid is translated.
    // A flat list (no pyramid on the source) is carried as heart notes: the
    // schema has three arrays and the heart is the one a reader takes as
    // "what this smells of" rather than a claim about the opening or drydown.
    const notesTop = c.notesTop ?? mn(h.notesTop);
    const notesHeart = c.notesHeart ?? mn(h.notesHeart) ?? mn(h.notesAll);
    const notesBase = c.notesBase ?? mn(h.notesBase);
    return {
      slug,
      sourceUrl: h.pageUrl,
      ...c,
      notesTop,
      notesHeart,
      notesBase,
      imageUrl: c.imageUrl ?? h.imageUrl,
      releaseYear: c.releaseYear ?? h.year,
    };
  });

  fs.writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n");

  const noImage = entries.filter((e) => !e.imageUrl).map((e) => e.slug);
  const noCopy = entries.filter((e) => !e.description).map((e) => e.slug);
  console.log(`${OUT}: ${entries.length} бичлэг.`);
  console.log(`  бичигдээгүй бараа: ${harvest.length - entries.length}`);
  if (noImage.length) console.log(`  ⚠︎ зураггүй: ${noImage.join(" ")}`);
  if (noCopy.length) console.log(`  ⚠︎ танилцуулгагүй: ${noCopy.join(" ")}`);
  if (untranslated.size)
    console.log(
      `  ⚠︎ notes.mn.json-д алга (${untranslated.size}): ` +
        [...untranslated].sort().join(", "),
    );
}

main();
