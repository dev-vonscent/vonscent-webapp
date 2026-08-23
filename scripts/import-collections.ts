/**
 * Import base collections from the Excel template into the database.
 *
 *   pnpm db:import-collections docs/import/collection-import-template.xlsx
 *
 * Reads the «Багц» sheet of the .xlsx (see docs/import/collection-import-guide.md),
 * resolves each row's 4 member product slugs to product ids, then upserts one
 * `collections` row (type='base') + exactly 4 `collection_items` per collection.
 * Re-running with the same `slug` updates in place (upsert) — never duplicates.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env, and
 * the 0028_collections.sql migration to have been applied.
 */
import * as path from "node:path";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

// `--dry` validates the Excel (read + shape checks) without touching the DB.
const args = process.argv.slice(2).filter((a) => a !== "--dry");
const dryRun = process.argv.includes("--dry");
const file = args[0];

if (!file) {
  console.error(
    "Usage: pnpm db:import-collections <file.xlsx> [--dry]\n" +
      "  e.g. pnpm db:import-collections docs/import/collection-import-template.xlsx",
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

// --dry never touches the DB, so skip client construction entirely there.
const supabase =
  !dryRun && url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;

const SHEET = "Багц";
const MEMBER_KEYS = [
  "product_slug_1",
  "product_slug_2",
  "product_slug_3",
  "product_slug_4",
] as const;

const GENDERS = ["male", "female", "unisex"] as const;

/** Header labels (as written in the template) mapped to internal keys. */
const HEADER_MAP: Record<string, string> = {
  "slug (URL)": "slug",
  "Нэр *": "name",
  Хүйс: "gender",
  Тайлбар: "description",
  "Хямдрал %": "discount_pct",
  "Бэлгийн ml": "gift_ml",
  "Зургийн URL": "image_url",
  Идэвхтэй: "is_active",
  Онцлох: "is_featured",
  "Үнэртэн slug 1 *": "product_slug_1",
  "Үнэртэн slug 2 *": "product_slug_2",
  "Үнэртэн slug 3 *": "product_slug_3",
  "Үнэртэн slug 4 *": "product_slug_4",
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

function truthy(v: unknown, dflt: boolean): boolean {
  if (v === undefined || v === null || v === "") return dflt;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "тийм";
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

interface Row {
  slug: string;
  name: string;
  gender: string;
  description: string;
  discount_pct: number;
  gift_ml: number | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  members: string[]; // 4 product slugs
  _rowNo: number;
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

async function readRows(): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) {
    throw new Error(
      `«${SHEET}» нэртэй хуудас олдсонгүй. Загварын нэрийг бүү өөрчил.`,
    );
  }
  // Header labels from row 1, by column number.
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = str(cellValue(cell.value));
  });
  const rows: Row[] = [];
  ws.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    // Normalize header labels to internal keys.
    const o: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const label = headers[col];
      if (!label) return;
      const k = HEADER_MAP[label.trim()] ?? label.trim();
      o[k] = cellValue(cell.value);
    });
    const name = str(o.name);
    const members = MEMBER_KEYS.map((k) => str(o[k]));
    // Skip fully-empty rows.
    if (!name && members.every((m) => !m)) return;
    rows.push({
      slug: slugify(str(o.slug) || name),
      name,
      gender: (str(o.gender) || "unisex").toLowerCase(),
      description: str(o.description),
      discount_pct: num(o.discount_pct) ?? 5,
      gift_ml: num(o.gift_ml),
      image_url: str(o.image_url) || null,
      is_active: truthy(o.is_active, true),
      is_featured: truthy(o.is_featured, false),
      members,
      _rowNo: rowNo,
    });
  });
  return rows;
}

function validate(rows: Row[]): string[] {
  const errors: string[] = [];
  const seenSlugs = new Set<string>();
  for (const row of rows) {
    const at = `Мөр ${row._rowNo}`;
    if (!row.name) errors.push(`${at}: «Нэр» хоосон байна.`);
    if (!row.slug) errors.push(`${at}: slug гаргаж чадсангүй (нэрээ бөглө).`);
    if (!GENDERS.includes(row.gender as (typeof GENDERS)[number]))
      errors.push(`${at}: «Хүйс» male/female/unisex-ийн нэг байх ёстой.`);
    if (seenSlugs.has(row.slug))
      errors.push(`${at}: slug «${row.slug}» давхардсан байна.`);
    seenSlugs.add(row.slug);
    const nonEmpty = row.members.filter(Boolean);
    if (nonEmpty.length !== 4)
      errors.push(
        `${at}: яг 4 үнэртэн slug шаардлагатай (${nonEmpty.length} өгсөн).`,
      );
    if (new Set(nonEmpty).size !== nonEmpty.length)
      errors.push(`${at}: 4 slug давхардаж болохгүй.`);
    if (row.gift_ml !== null && row.gift_ml <= 0)
      errors.push(`${at}: «Бэлгийн ml» эерэг тоо байх ёстой.`);
    if (row.discount_pct < 0 || row.discount_pct > 100)
      errors.push(`${at}: «Хямдрал %» 0–100 хооронд байх ёстой.`);
  }
  return errors;
}

async function main() {
  console.log(`Reading ${path.resolve(file)} …`);
  const rows = await readRows();
  if (rows.length === 0) {
    console.log("Импортлох мөр алга (бүх мөр хоосон).");
    return;
  }

  const errors = validate(rows);
  if (errors.length) {
    console.error(`\n${errors.length} алдаа олдлоо — импорт цуцлав:\n`);
    errors.forEach((e) => console.error("  • " + e));
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\n✓ Шалгалт (--dry): ${rows.length} багц зөв бүтэцтэй.\n`);
    rows.forEach((r) =>
      console.log(
        `  • ${r.slug} — «${r.name}» · ${r.gender} · ${r.discount_pct}% · бэлэг ${r.gift_ml ?? "default"}ml · [${r.members.join(", ")}]`,
      ),
    );
    console.log("\nDB-д хүрээгүй. Оруулахдаа --dry-г хасаж ажиллуул.");
    return;
  }
  if (!supabase) throw new Error("Supabase env тохируулаагүй байна.");

  // Resolve every member slug → product id in one query.
  const allSlugs = [...new Set(rows.flatMap((r) => r.members))];
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, slug")
    .in("slug", allSlugs);
  if (pErr) throw pErr;
  const idBySlug = new Map<string, string>(
    (products ?? []).map((p: { id: string; slug: string }) => [p.slug, p.id]),
  );
  const missing = allSlugs.filter((s) => !idBySlug.has(s));
  if (missing.length) {
    console.error(
      `\nDB-д олдоогүй үнэртэн slug (${missing.length}) — импорт цуцлав:\n`,
    );
    missing.forEach((s) => console.error("  • " + s));
    console.error(
      "\nЭдгээр барааг эхлээд каталогт оруулна уу, эсвэл slug-аа шалгана уу.",
    );
    process.exit(1);
  }

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    // Does it already exist? (to report create vs update)
    const { data: existing } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", row.slug)
      .maybeSingle();

    const { data: coll, error: cErr } = await supabase
      .from("collections")
      .upsert(
        {
          slug: row.slug,
          type: "base",
          user_id: null,
          name: row.name,
          gender: row.gender,
          description: row.description,
          discount_pct: row.discount_pct,
          image_url: row.image_url,
          gift_ml: row.gift_ml,
          is_active: row.is_active,
          is_featured: row.is_featured,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (cErr) throw cErr;

    // Replace members (exactly 4, ordered).
    await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", coll.id);
    const items = row.members.map((slug, i) => ({
      collection_id: coll.id,
      product_id: idBySlug.get(slug)!,
      sort_order: i + 1,
    }));
    const { error: iErr } = await supabase
      .from("collection_items")
      .insert(items);
    if (iErr) throw iErr;

    if (existing) updated++;
    else created++;
    console.log(`  ✓ ${row.slug} (${row.members.length} үнэртэн)`);
  }

  console.log(
    `\nДууслаа: ${created} шинэ, ${updated} шинэчилсэн, нийт ${rows.length} багц.`,
  );
}

main().catch((e) => {
  console.error("\nИмпорт амжилтгүй:", e.message ?? e);
  process.exit(1);
});
