/**
 * Import the product catalogue from the Excel template into the database.
 *
 *   pnpm db:import-products docs/import/real-product-list.xlsx --dry
 *   pnpm db:import-products docs/import/real-product-list.xlsx
 *
 * Reads the «Бүтээгдэхүүн» sheet (see docs/import/product-import-guide.md),
 * derives each row's slug from brand + name, then upserts `products` plus the
 * per-size `product_variants`, `product_images`, `inventory` and tag links.
 * Re-running with the same slug updates in place — never duplicates.
 *
 * The sheet is authoritative only for the columns the client actually filled.
 * A blank cell means «no opinion», not «erase»: on an existing product every
 * blank column is left exactly as it is, so a re-import can never wipe copy or
 * pictures an admin has since added. New products take the schema defaults.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env.
 */
import * as path from "node:path";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { ML_SIZES } from "../src/lib/constants";

// `--dry` validates the Excel (read + shape checks) without touching the DB.
// `--active` publishes the imported products to the storefront right away;
// without it a *newly created* product lands hidden (is_active = false), since
// a row with no pictures and no copy is not something a customer should meet.
const FLAGS = ["--dry", "--active"];
const args = process.argv.slice(2).filter((a) => !FLAGS.includes(a));
const dryRun = process.argv.includes("--dry");
const activate = process.argv.includes("--active");
const file = args[0];

if (!file) {
  console.error(
    "Usage: pnpm db:import-products <file.xlsx> [--dry] [--active]\n" +
      "  e.g. pnpm db:import-products docs/import/real-product-list.xlsx --dry",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!url || !key)) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env.",
  );
  process.exit(1);
}

const supabase =
  !dryRun && url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;

const SHEET = "Бүтээгдэхүүн";
/** Row 2 of the template carries the machine keys; data starts at row 3. */
const KEY_ROW = 2;

const GENDERS = ["male", "female", "unisex"] as const;
type Gender = (typeof GENDERS)[number];

/** Sheet writes Mongolian labels; the DB column is the enum. */
const GENDER_MAP: Record<string, Gender> = {
  эрэгтэй: "male",
  эмэгтэй: "female",
  юнисекс: "unisex",
  unisex: "unisex",
  male: "male",
  female: "female",
};

/**
 * `concentration_t` (0001 + 0016) is a closed six-value enum, while the client
 * writes marketing names — "edp intense", "elixir de parfum", "Extrait de
 * parfum". Each maps onto the enum member it *is*; the "intense" qualifier is
 * lost because the enum has no place for it (it survives in the product name
 * where the client put it there, e.g. «Explorer extreme»).
 */
const CONCENTRATION_MAP: Record<string, string> = {
  edp: "EDP",
  "eau de parfum": "EDP",
  "edp intense": "EDP",
  edt: "EDT",
  "eau de toilette": "EDT",
  "edt intense": "EDT",
  edc: "EDC",
  "eau de cologne": "EDC",
  parfum: "Parfum",
  elixir: "Elixir",
  "elixir de parfum": "Elixir",
  extrait: "Extrait",
  "extrait de parfum": "Extrait",
};

/**
 * The client typed brands by ear ("Tom ford", "Parfums de marley"). Brand is a
 * storefront filter facet, so casing decides whether two rows group as one
 * house — normalise to the house's own spelling. Anything not listed keeps the
 * spelling from the sheet, and is reported so the list can grow.
 */
const BRAND_MAP: Record<string, string> = {
  "giorgio armani": "Giorgio Armani",
  "emporio armani": "Emporio Armani",
  "hugo boss": "Hugo Boss",
  "jean paul gaultier": "Jean Paul Gaultier",
  "louis vuitton": "Louis Vuitton",
  "maison francis kurkdjian": "Maison Francis Kurkdjian",
  "maison margiela": "Maison Margiela",
  "miss dior": "Miss Dior",
  "parfums de marley": "Parfums de Marly",
  "parfums de marly": "Parfums de Marly",
  "ralph lauren": "Ralph Lauren",
  "tom ford": "Tom Ford",
  "le labo": "Le Labo",
  "victoria's secret": "Victoria's Secret",
  "viktor&rolf": "Viktor&Rolf",
  "yves saint laurent": "Yves Saint Laurent",
};

const SEASON_MAP: Record<string, string> = {
  хавар: "spring",
  зун: "summer",
  намар: "autumn",
  өвөл: "winter",
  "бүх улирал": "all",
};

/** Badge tags are the fixed customer-facing trio in `tags` (0003). */
const BADGE_MAP: Record<string, string> = {
  шинэ: "new",
  эрэлттэй: "hot",
  хямдрал: "sale",
  new: "new",
  hot: "hot",
  sale: "sale",
};

/** Latin/Cyrillic → url slug. Mongolian Cyrillic is transliterated. */
const CYR: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  ө: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ү: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => (ch in CYR ? CYR[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Unwrap ExcelJS cell values (rich text, formulas, hyperlinks) to primitives. */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return v.result ?? "";
    if ("text" in v) return v.text;
    if ("hyperlink" in v) return v.hyperlink;
    return "";
  }
  return v;
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * Money and ml are integer ₮ / integer ml (development.md §5). Excel hands
 * back floats for cells it computed (48000.00000000001), so round rather than
 * truncate — the client typed a round number and meant it.
 */
function int(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Split a «a; b; c» multi-value cell. Semicolon only — a comma is part of the
 * value here («Оффис, ажлын өдөр» is one tag), as the template instructs.
 */
function list(v: unknown): string[] {
  return str(v)
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Row {
  rowNo: number;
  slug: string;
  name: string;
  brand: string;
  gender: Gender;
  concentration: string;
  bottleMl: number;
  /** Below here every field is optional — absent means «leave alone». */
  bottlePrice: number | null;
  onHandMl: number | null;
  salePct: number | null;
  releaseYear: number | null;
  originCountry: string;
  scentFamilies: string[];
  seasons: string[];
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  shortDescription: string;
  description: string;
  notesDescription: string;
  usageDescription: string;
  imageLinks: string[];
  customTags: string[];
  badgeTags: string[];
}

interface ReadResult {
  rows: Row[];
  /** Row numbers dropped as template examples, for the report. */
  examples: number[];
  /** Brands passed through unmapped — worth a human glance. */
  unmappedBrands: string[];
}

/**
 * The template ships two filled-in example rows the guide asks the client to
 * delete; this one still has them. They are recognisable by the ellipsis the
 * template author left in every long cell ("Christian Dior-ийн 2015 онд
 * гаргасан...", ".../view") — real data has no such placeholder.
 */
function isExampleRow(o: Record<string, unknown>): boolean {
  return ["description", "image_links", "notes_description"].some((k) =>
    /\.\.\.|…/.test(str(o[k])),
  );
}

async function readRows(): Promise<ReadResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) {
    throw new Error(
      `«${SHEET}» нэртэй хуудас олдсонгүй. Загварын нэрийг бүү өөрчил.`,
    );
  }

  const keys: string[] = [];
  ws.getRow(KEY_ROW).eachCell({ includeEmpty: true }, (cell, col) => {
    keys[col] = str(cellValue(cell.value));
  });

  const rows: Row[] = [];
  const examples: number[] = [];
  const unmapped = new Set<string>();

  ws.eachRow((row, rowNo) => {
    if (rowNo <= KEY_ROW) return;
    const o: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const k = keys[col];
      if (k) o[k] = cellValue(cell.value);
    });

    const name = str(o.name);
    const brandRaw = str(o.brand);
    if (!name && !brandRaw) return; // fully empty row
    if (isExampleRow(o)) {
      examples.push(rowNo);
      return;
    }

    const brand = BRAND_MAP[brandRaw.toLowerCase()] ?? brandRaw;
    if (brandRaw && !BRAND_MAP[brandRaw.toLowerCase()]) unmapped.add(brandRaw);

    const conc = str(o.concentration).toLowerCase();

    rows.push({
      rowNo,
      slug: slugify(`${brand} ${name}`),
      name,
      brand,
      gender: GENDER_MAP[str(o.gender).toLowerCase()] ?? ("" as Gender),
      concentration: CONCENTRATION_MAP[conc] ?? "",
      bottleMl: int(o.bottle_ml) ?? 0,
      bottlePrice: int(o.bottle_price),
      onHandMl: int(o.on_hand_ml),
      salePct: int(o.sale_pct),
      releaseYear: int(o.release_year),
      originCountry: str(o.origin_country),
      scentFamilies: list(o.scent_families),
      seasons: list(o.seasons),
      notesTop: list(o.notes_top),
      notesHeart: list(o.notes_heart),
      notesBase: list(o.notes_base),
      shortDescription: str(o.short_description),
      description: str(o.description),
      notesDescription: str(o.notes_description),
      usageDescription: str(o.usage_description),
      imageLinks: list(o.image_links),
      customTags: list(o.custom_tags),
      badgeTags: list(o.badge_tags),
    });
    // Per-size prices: price_2ml … price_20ml. A size the client left blank is
    // simply absent — no variant row is written for it.
    const prices = new Map<number, number>();
    for (const ml of ML_SIZES) {
      const price = int(o[`price_${ml}ml`]);
      if (price !== null) prices.set(ml, price);
    }
    priceCache.set(rowNo, prices);
  });

  return { rows, examples, unmappedBrands: [...unmapped].sort() };
}

/** rowNo → { ml: price ₮ } for every size the client priced. */
const priceCache = new Map<number, Map<number, number>>();

function validate(rows: Row[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const at = `Мөр ${r.rowNo} (${r.brand} ${r.name})`;
    if (!r.name) errors.push(`${at}: «Нэр» хоосон.`);
    if (!r.brand) errors.push(`${at}: «Брэнд» хоосон.`);
    if (!r.slug) errors.push(`${at}: slug гаргаж чадсангүй.`);
    if (!GENDERS.includes(r.gender))
      errors.push(`${at}: «Хүйс» танигдсангүй (Эрэгтэй/Эмэгтэй/Юнисекс).`);
    if (!r.concentration)
      errors.push(`${at}: «Төрөл» танигдсангүй (EDP/EDT/Parfum/…).`);
    if (r.bottleMl <= 0) errors.push(`${at}: «Эх сав (ml)» эерэг тоо байх ёстой.`);
    const prices = priceCache.get(r.rowNo);
    if (!prices || prices.size === 0)
      errors.push(`${at}: ямар ч хэмжээний үнэ бөглөөгүй.`);
    for (const [ml, p] of prices ?? []) {
      if (p < 0) errors.push(`${at}: ${ml}ml үнэ сөрөг байна.`);
    }
    if (r.salePct !== null && (r.salePct < 0 || r.salePct > 100))
      errors.push(`${at}: «Хямдрал %» 0–100 хооронд байх ёстой.`);
    const dupe = seen.get(r.slug);
    if (dupe)
      errors.push(`${at}: slug «${r.slug}» ${dupe}-р мөртэй давхардаж байна.`);
    else seen.set(r.slug, r.rowNo);
  }
  return errors;
}

/** Columns the sheet left blank are omitted, so an update never erases them. */
function productPatch(r: Row): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    concentration: r.concentration,
    bottle_ml: r.bottleMl,
  };
  if (r.bottlePrice !== null) patch.bottle_price = r.bottlePrice;
  if (r.salePct !== null) patch.sale_pct = r.salePct;
  if (r.releaseYear !== null) patch.release_year = r.releaseYear;
  if (r.originCountry) patch.origin_country = r.originCountry;
  if (r.scentFamilies.length) patch.scent_families = r.scentFamilies;
  if (r.seasons.length) patch.seasons = r.seasons;
  if (r.notesTop.length) patch.notes_top = r.notesTop;
  if (r.notesHeart.length) patch.notes_heart = r.notesHeart;
  if (r.notesBase.length) patch.notes_base = r.notesBase;
  if (r.shortDescription) patch.short_description = r.shortDescription;
  if (r.description) patch.description = r.description;
  if (r.notesDescription) patch.notes_description = r.notesDescription;
  if (r.usageDescription) patch.usage_description = r.usageDescription;
  return patch;
}

/**
 * Sheet labels → the slugs the taxonomy tables use. Unknown labels are
 * reported rather than invented: `scent_families` and `custom_tags` are
 * admin-owned lists, and inventing a slug there would fork the taxonomy.
 */
function resolveLabels(
  labels: string[],
  bySlug: Map<string, string>,
  byLabel: Map<string, string>,
  unknown: Set<string>,
): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const hit =
      byLabel.get(label.toLowerCase()) ?? bySlug.get(label.toLowerCase());
    if (hit) out.push(hit);
    else unknown.add(label);
  }
  return out;
}

async function main() {
  console.log(`Reading ${path.resolve(file)} …`);
  const { rows, examples, unmappedBrands } = await readRows();

  if (examples.length)
    console.log(
      `  загварын жишээ мөр алгасав: ${examples.join(", ")} (${examples.length})`,
    );
  if (rows.length === 0) {
    console.log("Импортлох мөр алга.");
    return;
  }

  const errors = validate(rows);
  if (errors.length) {
    console.error(`\n${errors.length} алдаа олдлоо — импорт цуцлав:\n`);
    errors.forEach((e) => console.error("  • " + e));
    process.exit(1);
  }

  const noStock = rows.filter((r) => !r.onHandMl).length;
  const noImage = rows.filter((r) => !r.imageLinks.length).length;
  const noCost = rows.filter((r) => r.bottlePrice === null).length;
  const noCopy = rows.filter((r) => !r.description).length;

  console.log(`\n✓ ${rows.length} бараа зөв бүтэцтэй.`);
  if (unmappedBrands.length)
    console.log(
      `  ⚠︎ брэндийн нэрийг хэвээр авав (BRAND_MAP-д алга): ${unmappedBrands.join(", ")}`,
    );
  console.log(
    `  ⚠︎ хоосон талбар: үлдэгдэл ${noStock}, зураг ${noImage}, эх савны үнэ ${noCost}, танилцуулга ${noCopy}`,
  );

  if (dryRun) {
    console.log("");
    for (const r of rows) {
      const p = priceCache.get(r.rowNo)!;
      const sizes = [...p.entries()]
        .map(([ml, v]) => `${ml}ml:${v.toLocaleString("en-US")}`)
        .join(" ");
      console.log(
        `  • ${r.slug} — ${r.brand} «${r.name}» · ${r.gender} · ${r.concentration} · ${r.bottleMl}ml · ${sizes}`,
      );
    }
    console.log("\nDB-д хүрээгүй. Оруулахдаа --dry-г хасаж ажиллуул.");
    return;
  }
  if (!supabase) throw new Error("Supabase env тохируулаагүй байна.");

  // Taxonomy lookups, once.
  const [{ data: fams }, { data: badges }, { data: ctags }] = await Promise.all(
    [
      supabase.from("scent_families").select("slug, label"),
      supabase.from("tags").select("id, slug"),
      supabase.from("custom_tags").select("id, slug, name"),
    ],
  );
  const famBySlug = new Map(
    (fams ?? []).map((f: { slug: string }) => [f.slug.toLowerCase(), f.slug]),
  );
  const famByLabel = new Map(
    (fams ?? []).map((f: { slug: string; label: string }) => [
      f.label.toLowerCase(),
      f.slug,
    ]),
  );
  const badgeId = new Map(
    (badges ?? []).map((t: { id: string; slug: string }) => [t.slug, t.id]),
  );
  const ctagBySlug = new Map(
    (ctags ?? []).map((t: { id: string; slug: string }) => [
      t.slug.toLowerCase(),
      t.id,
    ]),
  );
  const ctagByLabel = new Map(
    (ctags ?? []).map((t: { id: string; name: string }) => [
      t.name.toLowerCase(),
      t.id,
    ]),
  );

  const { data: existingRows } = await supabase
    .from("products")
    .select("slug")
    .in(
      "slug",
      rows.map((r) => r.slug),
    );
  const existing = new Set(
    (existingRows ?? []).map((p: { slug: string }) => p.slug),
  );

  const unknownFamilies = new Set<string>();
  const unknownTags = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const isNew = !existing.has(r.slug);
    const patch = productPatch(r);

    // Taxonomy: only overwrite when the sheet actually named families.
    if (r.scentFamilies.length) {
      const resolved = resolveLabels(
        r.scentFamilies,
        famBySlug,
        famByLabel,
        unknownFamilies,
      );
      if (resolved.length) patch.scent_families = resolved;
      else delete patch.scent_families;
    }
    if (r.seasons.length) {
      const seasons = r.seasons
        .map((s) => SEASON_MAP[s.toLowerCase()] ?? s.toLowerCase())
        .filter((s) =>
          ["spring", "summer", "autumn", "winter", "all"].includes(s),
        );
      if (seasons.length) patch.seasons = seasons;
      else delete patch.seasons;
    }
    // A brand-new row needs the NOT NULL columns the sheet left blank.
    if (isNew) {
      patch.bottle_price = r.bottlePrice ?? 0;
      patch.is_active = activate;
    } else if (activate) {
      patch.is_active = true;
    }

    const { data: product, error } = await supabase
      .from("products")
      .upsert(patch, { onConflict: "slug" })
      .select("id")
      .single();
    if (error || !product) {
      console.error(`  ✗ ${r.slug}: ${error?.message}`);
      continue;
    }
    const id = (product as { id: string }).id;

    // Variants — one row per priced size, upserted so an unpriced size keeps
    // whatever the admin set. Money is integer ₮ (development.md §5).
    const prices = priceCache.get(r.rowNo)!;
    const { error: vErr } = await supabase.from("product_variants").upsert(
      [...prices.entries()].map(([ml, price]) => ({
        product_id: id,
        ml,
        price,
        is_active: true,
      })),
      { onConflict: "product_id,ml" },
    );
    if (vErr) console.error(`  ✗ ${r.slug} variants: ${vErr.message}`);

    // Inventory: create the row so the product is tracked, but never move an
    // existing count — stock is the admin's live number, not the sheet's.
    if (isNew || r.onHandMl !== null) {
      const inv: Record<string, unknown> = { product_id: id };
      if (r.onHandMl !== null) {
        inv.on_hand_ml = r.onHandMl;
        inv.is_sold_out = r.onHandMl <= 0;
      } else {
        inv.on_hand_ml = 0;
        inv.is_sold_out = true;
      }
      const { error: iErr } = await supabase
        .from("inventory")
        .upsert(inv, { onConflict: "product_id" });
      if (iErr) console.error(`  ✗ ${r.slug} inventory: ${iErr.message}`);
    }

    // Images — replace the gallery only when the sheet supplies one.
    if (r.imageLinks.length) {
      await supabase.from("product_images").delete().eq("product_id", id);
      await supabase.from("product_images").insert(
        r.imageLinks.map((u, n) => ({
          product_id: id,
          url: u,
          alt: `${r.brand} ${r.name}`,
          sort_order: n,
          is_visible: true,
        })),
      );
    }

    // Badge tags (new/hot/sale) and internal custom tags.
    if (r.badgeTags.length) {
      const ids = r.badgeTags
        .map((t) => badgeId.get(BADGE_MAP[t.toLowerCase()] ?? ""))
        .filter((v): v is string => Boolean(v));
      await supabase.from("product_tags").delete().eq("product_id", id);
      if (ids.length)
        await supabase
          .from("product_tags")
          .insert(ids.map((tag_id) => ({ product_id: id, tag_id })));
    }
    if (r.customTags.length) {
      const ids = resolveLabels(
        r.customTags,
        ctagBySlug,
        ctagByLabel,
        unknownTags,
      );
      await supabase.from("product_custom_tags").delete().eq("product_id", id);
      if (ids.length)
        await supabase
          .from("product_custom_tags")
          .insert(ids.map((tag_id) => ({ product_id: id, tag_id })));
    }

    if (isNew) created++;
    else updated++;
    console.log(`  ${isNew ? "+" : "~"} ${r.slug}`);
  }

  if (unknownFamilies.size)
    console.log(
      `\n⚠︎ танигдаагүй үнэрийн бүл (алгасав): ${[...unknownFamilies].join(", ")}`,
    );
  if (unknownTags.size)
    console.log(
      `⚠︎ танигдаагүй нэмэлт таг (алгасав): ${[...unknownTags].join(", ")}`,
    );

  console.log(
    `\nДууслаа: ${created} шинэ, ${updated} шинэчилсэн, нийт ${rows.length} бараа.` +
      (activate ? "" : `\nШинэ бараа нуугдмал (is_active = false) орлоо.`),
  );
}

main().catch((e) => {
  console.error("\nИмпорт амжилтгүй:", e.message ?? e);
  process.exit(1);
});
