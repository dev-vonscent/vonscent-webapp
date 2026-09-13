/**
 * Quiz-ийн таг-ийн ХАМРАЛТ шалгагч.
 *
 *   pnpm check:quiz-tags            (DATABASE_URL шаардана)
 *
 * «Үнэрээ ол» quiz нь барааг `custom_tags.slug`-аар тулгадаг бөгөөд жин нь
 * `features/quiz/questions.ts`-д ГАРААР бичигдсэн байдаг. Тиймээс админ шинэ
 * таг нэмэхэд quiz түүнийг ӨӨРӨӨ мэдэхгүй — оноонд огт нөлөөлөхгүй, ямар ч
 * алдаа гаргалгүй чимээгүй унтарна (0077-оос өмнө кирилл slug-ууд яг ингэж
 * унтарсан). Энэ скрипт тэр чимээгүй зөрүүг харагдуулна:
 *
 *   1. quiz-д бичигдсэн боловч санд БАЙХГҮЙ slug — үхсэн жин (устсан/нэр солигдсон).
 *   2. Бараанд зүүгдсэн боловч quiz-д жингүй таг — ашиглагдаагүй дохио.
 *   3. Кирилл slug — админ хуудас латин руу буулгадаг тул 0 байх ёстой.
 *
 * Сан шаарддаг тул CI-д ОРООГҮЙ: клиент таг нэмсний дараа гараар ажиллуулна.
 */
import { connectDb } from "./db";
import { QUIZ_QUESTIONS } from "../src/features/quiz/questions";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.local).");
  process.exit(1);
}

/** slug → нийт жин (бүх сонголтоор нийлбэр) — хэр хүчтэй дохио болохыг харуулна. */
const weighted = new Map<string, number>();
for (const q of QUIZ_QUESTIONS)
  for (const o of q.options)
    for (const [slug, n] of Object.entries(o.weights.tags ?? {}))
      weighted.set(slug, (weighted.get(slug) ?? 0) + n);

async function main() {
  const client = await connectDb(url!);
  const { rows } = await client.query<{
    slug: string;
    name: string;
    products: number;
  }>(`select t.slug, t.name, count(pt.product_id)::int as products
        from custom_tags t
        left join product_custom_tags pt on pt.tag_id = t.id
       group by t.slug, t.name
       order by products desc, t.slug`);
  await client.end();

  const pool = new Map(rows.map((r) => [r.slug, r]));

  const dead = [...weighted.keys()].filter((s) => !pool.has(s));
  /**
 * Санд байгаа ч quiz-д ЗОРИУД жингүй үлдээсэн таг: scorer аль хэдийн уншдаг
 * тэнхлэгийг (scent_families / seasons) давхардуулсан тул жин өгвөл нэг дохиог
 * хоёр удаа тоолно. questions.ts-ийн тайлбартай хамт хөтлөнө.
 */
const INTENTIONALLY_UNWEIGHTED = new Set([
  "woody",
  "citrus",
  "fresh",
  "floral",
  "spring",
  "summer",
  "autumn",
  "winter",
  "all-season",
  // Худалдан авалтын нөхцөл, үнэрийн сонголт БИШ — quiz үүнийг асуудаггүй.
  "gift-ready",
]);

const unused = rows.filter(
  (r) => r.products > 0 && !weighted.has(r.slug) && !INTENTIONALLY_UNWEIGHTED.has(r.slug),
);
  const cyrillic = rows.filter((r) => /[а-яөүёА-ЯӨҮЁ]/u.test(r.slug));

  const fmt = (r: { slug: string; name: string; products: number }) =>
    `${r.slug.padEnd(16)} ${r.name.padEnd(24)} ${r.products} бараа`;

  console.log(
    `\nТаг: ${rows.length}, quiz-д жинтэй: ${weighted.size}\n` +
      "─".repeat(56),
  );

  if (dead.length) {
    console.log("\n⚠ quiz-д бичигдсэн ч санд байхгүй slug (жин нь үхсэн):");
    for (const s of dead) console.log(`   ${s}`);
  }

  if (cyrillic.length) {
    console.log("\n⚠ кирилл slug (quiz-ээс харагдахгүй):");
    for (const r of cyrillic) console.log(`   ${fmt(r)}`);
  }

  if (unused.length) {
    console.log("\n• Бараанд зүүгдсэн ч quiz-д жингүй таг:");
    for (const r of unused) console.log(`   ${fmt(r)}`);
    console.log(
      "\n  → questions.ts дэх аль нэг сонголтын `tags` дотор нэмбэл quiz оноонд орно.",
    );
  }

  if (!dead.length && !cyrillic.length && !unused.length) {
    console.log("\n✓ Бүх идэвхтэй таг quiz-д хамрагдсан байна.");
  }

  console.log();
  // Үхсэн жин ба кирилл slug нь алдаа; хамрагдаагүй таг нь зөвхөн мэдээлэл.
  if (dead.length || cyrillic.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
