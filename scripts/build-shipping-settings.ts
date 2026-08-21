/**
 * Build `settings.shipping` from the two zone CSVs the client fills in.
 *
 *   node --import tsx scripts/build-shipping-settings.ts            # write JSON
 *   node --env-file=.env.local --import tsx \
 *     scripts/build-shipping-settings.ts --apply                    # + upsert
 *
 * The CSVs are the source of truth (docs/delivery/delivery-zones-guide.md); this turns
 * them into the shape `getShippingSettings()` / `resolveZone()` expect:
 *   - Улаанбаатар rows become `MN1107:12` area keys (adm2 code + хороо)
 *   - orон нутаг rows are adm1, so each аймаг expands to all of its сум codes
 *   - zone `X` collects into one `deliverable: false` zone, which makes
 *     checkout throw UndeliverableZoneError instead of quoting a fee
 * Re-run it whenever the client returns an updated CSV.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

/** ₮ per zone letter — the client's A10 decision. */
const FEES: Record<string, number> = { A: 7000, B: 9000, C: 10000 };
const FREE_OVER = 150000;

/**
 * Display names. The letter is the zone's identity (`code`) and is what lands
 * on `orders.ship_zone`; these labels are only what customers read, so the
 * admin can reword them on the Тохиргоо page without breaking anything.
 */
const ZONE_LABEL: Record<string, string> = {
  A: "А бүс (хотын төв)",
  B: "Б бүс (алслагдсан хороолол)",
  C: "В бүс (захын хороолол)",
};
/** Countryside gets its own code so it can be re-priced apart from УБ-ийн Б. */
const RURAL_CODE = "R";
const RURAL = "Орон нутаг";
const BLOCKED_CODE = "X";
const UNDELIVERABLE = "Хүргэлт хийхгүй";

const root = process.cwd();
const docs = join(root, "docs", "delivery");

// ── CSV ────────────────────────────────────────────────────────────────────
/** Minimal RFC4180-ish reader: quoted fields + doubled quotes, no embedded \n. */
function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const out: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"') {
            if (line[i + 1] === '"') {
              cur += '"';
              i++;
            } else quoted = false;
          } else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out.map((c) => c.trim());
    });
}

function readCsv(file: string) {
  const [header, ...rows] = parseCsv(readFileSync(join(docs, file), "utf8"));
  const col = (prefix: string) => {
    const i = header.findIndex((h) => h.toLowerCase().startsWith(prefix));
    if (i < 0) throw new Error(`${file}: "${prefix}" багана олдсонгүй`);
    return i;
  };
  return { header, rows, col };
}

/** Uppercased zone letter, or "" when the cell is still blank. */
function zoneOf(row: string[], i: number): string {
  return (row[i] ?? "").trim().toUpperCase();
}

// ── geo: аймаг → сум codes ─────────────────────────────────────────────────
interface Adm {
  code: string;
  name: string;
  children: { code: string }[];
}
const geo = JSON.parse(
  readFileSync(join(root, "src/lib/geo/mn-locations.json"), "utf8"),
) as { aimags: Adm[] };
const SUMS_BY_AIMAG = new Map(
  geo.aimags.map((a) => [a.code, a.children.map((c) => c.code)]),
);

// ── collect areas per zone letter ──────────────────────────────────────────
const cityAreas: Record<string, string[]> = {};
const ruralAreas: Record<string, string[]> = {};
const skipped: string[] = [];

{
  const { rows, col } = readCsv("delivery-zones-ub-template.csv");
  const [ci, ki, zi] = [col("duureg_code"), col("khoroo"), col("zone")];
  for (const r of rows) {
    const z = zoneOf(r, zi);
    if (!z) {
      skipped.push(`УБ ${r[ci]} ${r[ki]}-р хороо`);
      continue;
    }
    (cityAreas[z] ??= []).push(`${r[ci]}:${Number(r[ki])}`);
  }
}
{
  const { rows, col } = readCsv("delivery-zones-rural-template.csv");
  const [ai, zi] = [col("aimag_code"), col("zone")];
  for (const r of rows) {
    const z = zoneOf(r, zi);
    const sums = SUMS_BY_AIMAG.get(r[ai]);
    if (!sums) {
      skipped.push(`Тодорхойгүй аймгийн код ${r[ai]}`);
      continue;
    }
    if (!z) {
      skipped.push(`Орон нутаг ${r[ai]}`);
      continue;
    }
    (ruralAreas[z] ??= []).push(...sums);
  }
}

// ── zones ──────────────────────────────────────────────────────────────────
interface ShippingZone {
  code: string;
  name: string;
  fee: number;
  deliverable: boolean;
  remote: boolean;
  areas: string[];
}
const zones: ShippingZone[] = [];

for (const letter of ["A", "B", "C"]) {
  const areas = cityAreas[letter];
  if (!areas?.length) continue;
  zones.push({
    code: letter,
    name: ZONE_LABEL[letter] ?? `${letter} бүс`,
    fee: FEES[letter] ?? 0,
    deliverable: true,
    remote: false,
    areas,
  });
}

// One "Орон нутаг" zone when every аймаг shares a letter, otherwise one each.
const ruralLetters = Object.keys(ruralAreas)
  .filter((l) => l !== BLOCKED_CODE)
  .sort();
for (const letter of ruralLetters) {
  const single = ruralLetters.length === 1;
  zones.push({
    code: single ? RURAL_CODE : `${RURAL_CODE}${letter}`,
    name: single ? RURAL : `${RURAL} (${letter} бүс)`,
    fee: FEES[letter] ?? 0,
    deliverable: true,
    remote: true,
    areas: ruralAreas[letter],
  });
}

const blocked = [...(cityAreas.X ?? []), ...(ruralAreas.X ?? [])];
if (blocked.length) {
  zones.push({
    code: BLOCKED_CODE,
    name: UNDELIVERABLE,
    fee: 0,
    deliverable: false,
    remote: false,
    areas: blocked,
  });
}

const settings = { zones, freeOver: FREE_OVER };

// ── output ─────────────────────────────────────────────────────────────────
const outFile = join(docs, "shipping-settings.json");
writeFileSync(outFile, JSON.stringify(settings, null, 2) + "\n", "utf8");

console.log("settings.shipping:");
for (const z of zones) {
  const kind = !z.deliverable ? "хүргэлтгүй" : z.remote ? "орон нутаг" : "хот";
  console.log(
    `  ${z.code.padEnd(3)} ${z.name.padEnd(30)} ${String(z.fee).padStart(6)}₮  ${String(z.areas.length).padStart(4)} area  (${kind})`,
  );
}
console.log(`  Үнэгүй хүргэлтийн босго: ${FREE_OVER}₮`);
console.log(`→ ${outFile}`);
if (skipped.length) {
  console.log(`\n⚠ ${skipped.length} мөр бөглөгдөөгүй тул орхигдсон:`);
  for (const s of skipped.slice(0, 10)) console.log(`   ${s}`);
  if (skipped.length > 10) console.log(`   … +${skipped.length - 10}`);
}

/** Upsert the built blob — the storefront reads it through getShippingSettings(). */
async function apply() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY алга (--env-file=.env.local).",
    );
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb
    .from("settings")
    .upsert({ key: "shipping", value: settings });
  if (error) throw new Error(`upsert: ${error.message}`);
  console.log("✓ settings.shipping шинэчлэгдлээ");
}

if (process.argv.includes("--apply")) {
  apply().catch((e: Error) => {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  });
}
