/**
 * `supabase/seed.sql`-ийг DATABASE_URL-ийн заасан санд ажиллуулна.
 *
 *   node --env-file=.env.von.dev --import tsx scripts/seed-sql.ts
 *
 * Яагаад `psql -f` биш вэ: Supabase-ийн шууд хост (`db.<ref>.supabase.co`) нь
 * зөвхөн IPv6 тул IPv4 сүлжээнээс psql хүрэхгүй. `scripts/db.ts` нь IPv4
 * Session pooler руу өөрөө шилждэг — migrate.ts, db-backup.ts-тэй ижил зам.
 *
 * ⚠️ seed.sql нь ЗӨВХӨН preview/local-д зориулагдсан. Өөрөө хамгаалалттай:
 * `orders`-д мөр байвал exception шиднэ. Энэ script нь түүнээс гадна аль сан
 * руу холбогдсоноо ажиллуулахын өмнө хэвлэж, баталгаа гуйна.
 */
import { connectDb } from "./db";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL тохируулаагүй (--env-file=… ашиглана уу).");
  process.exit(1);
}

/** Баталгаа асуухыг алгасах (CI г.м.). */
const skipPrompt = process.argv.includes("--yes");

async function main() {
  const ref =
    /db\.([a-z0-9]+)\.supabase\.co/u.exec(url!)?.[1] ?? "(тодорхойгүй)";

  const client = await connectDb(url!);

  // seed.sql-ийн хамгаалалттай ижил шалгуур: энэ файлын үүсгээгүй захиалга
  // байвал жинхэнэ борлуулалттай сан гэж үзнэ (seed-ийн id-ууд тогтмол).
  const { rows } = await client.query<{
    db: string;
    orders: string;
    foreign_orders: string;
  }>(`
    select current_database() as db,
           (select count(*) from orders)::text as orders,
           (select count(*) from orders
             where id::text not like '00000000-0000-4000-9000-%')::text
             as foreign_orders
  `);
  console.log(`\nSupabase project : ${ref}`);
  console.log(`Сан              : ${rows[0].db}`);
  console.log(`Захиалга         : ${rows[0].orders} (seed-ийн бус: ${rows[0].foreign_orders})`);

  if (rows[0].foreign_orders !== "0") {
    console.error(
      "\n✖ seed-ийн бус захиалга олдлоо. seed.sql нь production дээр ажиллахгүй.",
    );
    await client.end();
    process.exit(1);
  }

  if (!skipPrompt) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\nЭнэ санд seed ажиллуулах уу? (yes/no) `);
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Цуцаллаа.");
      await client.end();
      return;
    }
  }

  const sql = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");
  // seed.sql өөрөө begin/commit агуулдаг тул энд нэмэлт transaction нээхгүй.
  try {
    await client.query(sql);
    console.log("\n✅ seed.sql хэрэгжлээ.");
  } catch (e) {
    console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}`);
    await client.end();
    process.exit(1);
  }

  // Юу орсныг харуулна — «ажиллалаа» гэдэг нь «дата орлоо» гэсэн үг биш.
  const counts = await client.query<{ t: string; n: string }>(`
    select 'brands' as t, count(*)::text as n from brands
    union all select 'products',       count(*)::text from products
    union all select 'variants',       count(*)::text from product_variants
    union all select 'inventory',      count(*)::text from inventory
    union all select 'images',         count(*)::text from product_images
    union all select 'collections',    count(*)::text from collections
    union all select 'coupons',        count(*)::text from coupons
    union all select 'faqs',           count(*)::text from faqs
    union all select 'blog_posts',     count(*)::text from blog_posts
    union all select 'home_sections',  count(*)::text from home_sections
    union all select 'profiles',       count(*)::text from profiles
    union all select 'orders',         count(*)::text from orders
    union all select 'reviews',        count(*)::text from reviews
  `);
  console.table(counts.rows);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
