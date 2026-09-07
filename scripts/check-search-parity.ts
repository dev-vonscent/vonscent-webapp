/**
 * Хайлтын хэвийн болголтын ПАРИТЕТ шалгагч.
 *
 *   node --env-file=.env.local --import tsx scripts/check-search-parity.ts
 *
 * Глобал хайлт (0057_search.sql) хоёр талтай: хайх ҮГИЙГ браузар/сервер дээр
 * TypeScript-ийн `normalizeSearchText()` хэвийн болгодог бол ХАЙГДАХ ТЕКСТИЙГ
 * Postgres-ийн `search_normalize()` хэвийн болгож багана болгон хадгална.
 * Хоёр функц ялимгүй ч зөрвөл хайлт чимээгүйхэн буруудна («диор» гэж бичихэд
 * Dior олдохоо болино), тиймээс энэ скрипт хоёрыг нь бодит өгөгдөл дээр
 * тулгана. Schema өөрчлөгдөх бүрд биш, хоёр функцийн аль нэгийг ЗАСАХ үед
 * ажиллуулна.
 *
 * Шалгах багц: латин (ASCII + өргөлттэй), орос/монгол кирилл бүх үсэг, нийлмэл
 * тэмдэг, дээр нь сангийн бодит нэрс. Серб/украин/эртний кирилл (Ђ, Ѳ …) ба
 * Latin Extended-B (Ɓ, Ǝ …) багцад ОРООГҮЙ: SQL тал тэдгээрийг `lower()`-т
 * даалгадаг бөгөөд энэ нь сангийн locale-ээс хамаарна (Supabase дээр
 * en_US.UTF-8 тул зөв; C locale-тай туршилтын санд зөрнө). Дэлгүүрийн барааны
 * нэрэнд тэдгээр үсэг байхгүй тул зориудаар хамрахгүй орхив.
 */
import { connectDb } from "./db";
import { normalizeSearchText } from "../src/lib/search";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.local).");
  process.exit(1);
}

/** Every codepoint the two implementations could disagree about. */
function codepointCorpus(): string[] {
  const out: string[] = [];
  const ranges: [number, number][] = [
    [0x0020, 0x007e], // ASCII
    [0x00c0, 0x017f], // Latin-1 Supplement + Latin Extended-A
    [0x0300, 0x036f], // combining marks
    [0x0410, 0x044f], // Cyrillic А–я
  ];
  for (const [lo, hi] of ranges) {
    for (let c = lo; c <= hi; c++) out.push(String.fromCodePoint(c));
  }
  // Монгол өргөтгөл + Ё.
  out.push("Ё", "ё", "Ө", "ө", "Ү", "ү");
  return out;
}

const FIXED = [
  "Dior Sauvage",
  "Диор Соваж",
  "Hermès Terre d'Hermès",
  "Yves Saint Laurent",
  "ТОМ ФОРД",
  "Жо Малон",
  "Шанель №5",
  "Ёлка",
  "Өдөр тутмын ХЭРЭГЛЭЭ",
  "щётка ъь",
  "  олон   зайтай  ",
];

/** Table.column pairs whose live text lands in a search_text column. */
const LIVE = [
  ["products", "name"],
  ["products", "brand"],
  ["custom_tags", "name"],
  ["collections", "name"],
  ["collections", "description"],
  ["blog_posts", "title"],
  ["blog_posts", "excerpt"],
  ["blog_posts", "category"],
  ["brands", "name"],
] as const;

async function main() {
  const client = await connectDb(url!, false);

  const samples = new Set<string>([...codepointCorpus(), ...FIXED]);

  for (const [table, column] of LIVE) {
    try {
      const { rows } = await client.query<{ v: string }>(
        `select distinct ${column} as v from ${table} where ${column} is not null limit 2000`,
      );
      for (const r of rows) samples.add(r.v);
    } catch {
      // Тухайн хүснэгт байхгүй (жишээ нь туршилтын сан) — алгасна.
    }
  }

  const list = [...samples];
  const { rows } = await client.query<{ i: number; out: string }>(
    `select ord::int - 1 as i, search_normalize(t) as out
       from unnest($1::text[]) with ordinality as u(t, ord)`,
    [list],
  );

  let bad = 0;
  for (const row of rows) {
    const input = list[row.i];
    const ts = normalizeSearchText(input);
    if (ts !== row.out) {
      bad++;
      if (bad <= 20) {
        console.error(
          `✖ ${JSON.stringify(input)}\n    ts : ${JSON.stringify(ts)}\n    sql: ${JSON.stringify(row.out)}`,
        );
      }
    }
  }

  await client.end();
  console.log(
    bad === 0
      ? `✔ ${list.length} мөр шалгав — TS ба SQL хэвийн болголт ижил.`
      : `✖ ${bad}/${list.length} мөр зөрлөө.`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
