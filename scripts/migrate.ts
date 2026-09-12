/**
 * Apply SQL migrations in supabase/migrations/* to the database in DATABASE_URL.
 *
 *   node --env-file=.env.local --import tsx scripts/migrate.ts
 *
 * Migrations are idempotent (if-not-exists / duplicate-object guards), so this
 * is safe to re-run. Each file runs in its own transaction, in filename order.
 *
 * Supabase's direct host (db.<ref>.supabase.co) is IPv6-only; if it can't be
 * resolved we transparently fall back to the IPv4 Session pooler (scripts/db.ts).
 */
import { connectDb } from "./db";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.local).");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/**
 * Дугаар давхардсан файлуудыг `a`/`b` үсгээр ялгав — тэдгээр нь аль хэдийн
 * ажилласан сан дээр **дахин ажиллах ёсгүй**. `_app_migrations` нь файлын
 * нэрээр түлхүүрлэгддэг тул шинэ нэр → хуучин нэр.
 *
 * Яагаад шинэ дугаар өгөөгүй вэ: `0028`–`0031`, `0053`, `0054` бүгд зэрэг
 * явсан хоёр салаа нийлсний ул мөр. Үсэг залгах нь ажиллах ДАРААЛЛЫГ яг
 * хэвээр үлдээдэг (`0028_` < `0028a_` < `0028b_` < `0029…`) — шинэ дугаар руу
 * нүүлгэвэл дараалал өөрчлөгдөж, аль нэг нь хамаарлаасаа түрүүлэх эрсдэлтэй.
 *
 * Бүх сан шинэ нэрээр бүртгэгдсэн нь батлагдвал энэ хүснэгтийг устгаж болно.
 */
const RENAMED: Record<string, string> = {
  "0028a_collections.sql": "0028_collections.sql",
  "0028b_verify_mn.sql": "0028_verify_mn.sql",
  "0029a_drop_phone_otps.sql": "0029_drop_phone_otps.sql",
  "0029b_place_order_collections.sql": "0029_place_order_collections.sql",
  "0030a_image_generation.sql": "0030_image_generation.sql",
  "0030b_phone_auth.sql": "0030_phone_auth.sql",
  "0031a_product_reference_image.sql": "0031_product_reference_image.sql",
  "0031b_sample_tier_back.sql": "0031_sample_tier_back.sql",
  "0053a_gift_pool_single_source.sql": "0053_gift_pool_single_source.sql",
  "0053b_spin_wheel.sql": "0053_spin_wheel.sql",
  "0054a_real_discounts.sql": "0054_real_discounts.sql",
  "0054b_role_in_jwt.sql": "0054_role_in_jwt.sql",
};

// Давхардал дахин үүсэхээс сэргийлнэ: файлууд нэрээрээ эрэмбэлэгддэг тул
// яг ижил угтвартай хоёр файлын дараалал нь араас нь ирэх үгнээс шалтгаална —
// хэн ч зориуд сонгоогүй дараалал. Ажиллахаас нь өмнө зогсооно.
const byPrefix = new Map<string, string[]>();
for (const f of files) {
  const prefix = /^\d{4}[a-z]?/u.exec(f)?.[0] ?? f;
  byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), f]);
}
const duplicates = [...byPrefix.entries()].filter(([, fs]) => fs.length > 1);
if (duplicates.length > 0) {
  console.error("✖ Migration-ий дугаар давхардсан байна:");
  for (const [prefix, fs] of duplicates) {
    console.error(`  ${prefix}: ${fs.join(", ")}`);
  }
  console.error(
    "  Шинэ дугаар өг, эсвэл дарааллыг хадгалахаар `a`/`b` үсэг залгаад " +
      "scripts/migrate.ts-ийн RENAMED-д бич.",
  );
  process.exit(1);
}

async function main() {
  const client = await connectDb(url!);

  // Track which migrations have run so re-runs only apply new ones.
  await client.query(
    `create table if not exists _app_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
  const appliedRes = await client.query<{ name: string }>(
    "select name from _app_migrations",
  );
  const applied = new Set(appliedRes.rows.map((r) => r.name));

  // SQLSTATEs that mean "object already exists" — treat as already-applied
  // (covers triggers/policies from a prior partial run without tracking).
  const DUP_CODES = new Set([
    "42710",
    "42P07",
    "42P06",
    "42723",
    "42701",
    "42P04",
    "42P16",
  ]);

  console.log(`${applied.size} already applied. Checking ${files.length}…\n`);
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• ${file} (skipped)`);
      continue;
    }
    // Нэр нь солигдсон файл: хуучин нэрээр нь бүртгэгдсэн бол ажиллуулахгүй,
    // зөвхөн шинэ нэрийг нь нэмж бичнэ.
    const previousName = RENAMED[file];
    if (previousName && applied.has(previousName)) {
      await client.query(
        "insert into _app_migrations(name) values ($1) on conflict do nothing",
        [file],
      );
      console.log(`• ${file} (нэр солигдсон: ${previousName})`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into _app_migrations(name) values ($1) on conflict do nothing",
        [file],
      );
      await client.query("commit");
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (DUP_CODES.has(code)) {
        await client.query(
          "insert into _app_migrations(name) values ($1) on conflict do nothing",
          [file],
        );
        console.log(`• ${file} (already applied)`);
        continue;
      }
      console.error(`✖ ${file}`);
      console.error(`  ${err instanceof Error ? err.message : String(err)}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n✅ All migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
