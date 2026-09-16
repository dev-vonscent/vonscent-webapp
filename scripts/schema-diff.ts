/**
 * Хоёр Postgres сангийн schema-г харьцуулна — **зөвхөн унших** (SELECT).
 *
 *   DB_A=<url> DB_B=<url> node --import tsx scripts/schema-diff.ts
 *   DB_A=... DB_B=... A_LABEL=prod B_LABEL=preview node --import tsx scripts/schema-diff.ts
 *
 * Нэг л сан өгвөл (`DB_A` дангаар) түүний `_app_migrations`-ийг диск дэх
 * `supabase/migrations/*.sql`-тэй харьцуулна — "prod дээр яг энэ 90 файл
 * ажилласан уу?" гэдгийг батлах зориулалттай.
 *
 * Яагаад `supabase db diff` биш вэ: энэ репо Supabase CLI-ийн migration
 * системийг ашигладаггүй (scripts/migrate.ts + `_app_migrations`), мөн CLI
 * нь Docker шаарддаг. Энэ script нь catalog-оос шууд уншдаг тул хамааралгүй.
 *
 * Бичих үйлдэл ОГТ хийхгүй — DDL, DML, temp table аль нь ч байхгүй.
 */
import { connectDb } from "./db";
import type { Client } from "pg";
import { readdirSync } from "node:fs";
import { join } from "node:path";

interface Section {
  /** Тайлангийн гарчиг. */
  title: string;
  /** Нэг мөр = нэг обьект. `key` нь таних нэр, `body` нь харьцуулах агуулга. */
  sql: string;
  /** Уг обьект байхгүй бол (extension суугаагүй г.м.) алгасах. */
  optional?: boolean;
}

/**
 * Бүх хэсэг `key` (обьектын нэр) ба `body` (тодорхойлолт) хоёр багана буцаана.
 * `body` ялгаатай бол "өөр", нэг талд байхгүй бол "дутуу/илүү" гэж тайлагдана.
 */
const SECTIONS: Section[] = [
  {
    title: "Extensions",
    sql: `select extname as key, extversion as body
          from pg_extension order by 1`,
  },
  {
    title: "Enum төрлүүд",
    sql: `select t.typname as key,
                 string_agg(e.enumlabel, ',' order by e.enumsortorder) as body
          from pg_type t
          join pg_enum e on e.enumtypid = t.oid
          join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public'
          group by t.typname order by 1`,
  },
  {
    title: "Хүснэгт / багана",
    sql: `select c.table_name || '.' || c.column_name as key,
                 c.data_type
                   || coalesce('(' || c.character_maximum_length || ')', '')
                   || ' null=' || c.is_nullable
                   || ' default=' || coalesce(c.column_default, '-') as body
          from information_schema.columns c
          join information_schema.tables t
            on t.table_schema = c.table_schema and t.table_name = c.table_name
          where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
          order by 1`,
  },
  {
    title: "Constraint (PK / FK / unique / check)",
    sql: `select (con.conrelid::regclass)::text || ' ' || con.conname as key,
                 pg_get_constraintdef(con.oid) as body
          from pg_constraint con
          join pg_namespace n on n.oid = con.connamespace
          where n.nspname = 'public'
          order by 1`,
  },
  {
    title: "Index",
    sql: `select indexname as key, indexdef as body
          from pg_indexes where schemaname = 'public' order by 1`,
  },
  {
    title: "RLS асаалттай эсэх",
    sql: `select c.relname as key,
                 'rls=' || c.relrowsecurity || ' force=' || c.relforcerowsecurity as body
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
          order by 1`,
  },
  {
    title: "RLS policy (public + storage)",
    sql: `select schemaname || '.' || tablename || '.' || policyname as key,
                 cmd || ' roles=' || roles::text
                     || ' using=' || coalesce(qual, '-')
                     || ' check=' || coalesce(with_check, '-') as body
          from pg_policies
          where schemaname in ('public', 'storage')
          order by 1`,
  },
  {
    title: "Function / RPC",
    sql: `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as key,
                 pg_get_functiondef(p.oid) as body
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prokind in ('f', 'p')
          order by 1`,
  },
  {
    title: "Trigger",
    sql: `select c.relname || '.' || t.tgname as key,
                 pg_get_triggerdef(t.oid) as body
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and not t.tgisinternal
          order by 1`,
  },
  {
    title: "View",
    sql: `select table_name as key, view_definition as body
          from information_schema.views
          where table_schema = 'public' order by 1`,
  },
  {
    title: "Storage bucket",
    sql: `select id as key,
                 'public=' || public
                   || ' size_limit=' || coalesce(file_size_limit::text, '-')
                   || ' mime=' || coalesce(allowed_mime_types::text, '-') as body
          from storage.buckets order by 1`,
    optional: true,
  },
  {
    title: "pg_cron job",
    sql: `select jobname as key,
                 schedule || ' | ' || command || ' | active=' || active as body
          from cron.job order by 1`,
    optional: true,
  },
  {
    title: "Хэрэгжсэн migration (_app_migrations)",
    sql: `select name as key, '' as body from _app_migrations order by 1`,
    optional: true,
  },
];

type Rows = Map<string, string>;

async function fetchSection(
  client: Client,
  section: Section,
): Promise<Rows | null> {
  try {
    const res = await client.query<{ key: string; body: string }>(section.sql);
    return new Map(res.rows.map((r) => [r.key, r.body ?? ""]));
  } catch (e) {
    if (section.optional) return null;
    throw e;
  }
}

/** Олон мөрт тодорхойлолтыг нэг мөрд багтаахаар товчилно. */
function brief(s: string, max = 100): string {
  const flat = s.replace(/\s+/gu, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

function compare(
  title: string,
  a: Rows | null,
  b: Rows | null,
  aLabel: string,
  bLabel: string,
): number {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);

  if (a === null && b === null) {
    console.log("   (хоёуланд нь байхгүй — алгаслаа)");
    return 0;
  }
  if (a === null || b === null) {
    const present = a === null ? bLabel : aLabel;
    const missing = a === null ? aLabel : bLabel;
    console.log(`   ⚠ ${present}-д байна, ${missing}-д БАЙХГҮЙ (${(a ?? b)!.size} мөр)`);
    return 1;
  }

  const onlyA = [...a.keys()].filter((k) => !b.has(k));
  const onlyB = [...b.keys()].filter((k) => !a.has(k));
  const differs = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));

  if (onlyA.length === 0 && onlyB.length === 0 && differs.length === 0) {
    console.log(`   ✓ ижил (${a.size})`);
    return 0;
  }

  for (const k of onlyA) console.log(`   − зөвхөн ${aLabel}: ${k}`);
  for (const k of onlyB) console.log(`   + зөвхөн ${bLabel}: ${k}`);
  for (const k of differs) {
    console.log(`   ≠ ${k}`);
    console.log(`       ${aLabel}: ${brief(a.get(k)!)}`);
    console.log(`       ${bLabel}: ${brief(b.get(k)!)}`);
  }
  return onlyA.length + onlyB.length + differs.length;
}

/** Диск дэх migration файлууд ба санд бүртгэгдсэнийг харьцуулна. */
function compareWithDisk(applied: Rows | null, label: string): number {
  console.log(`\n── ${label}: _app_migrations ↔ диск дэх файлууд ────────────`);
  if (applied === null) {
    console.log("   ⚠ `_app_migrations` хүснэгт байхгүй — migration огт ажиллаагүй бололтой");
    return 1;
  }
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

  // migrate.ts-ийн RENAMED хүснэгттэй адил: нэр солигдсоныг давхар тооцно.
  const appliedNames = new Set(applied.keys());
  const missing = files.filter((f) => !appliedNames.has(f));
  const extra = [...appliedNames].filter((n) => !files.includes(n));

  console.log(`   диск: ${files.length} файл · сан: ${applied.size} бүртгэл`);
  for (const f of missing) console.log(`   − санд бүртгэгдээгүй: ${f}`);
  for (const n of extra) console.log(`   + дискэнд байхгүй нэр: ${n}`);
  if (missing.length === 0 && extra.length === 0) console.log("   ✓ бүрэн таарч байна");
  return missing.length + extra.length;
}

async function main() {
  // `--env-file=.env.von.prd`-ээр ачаалсан үед DB_A-г дахин бичих шаардлагагүй.
  const urlA = process.env.DB_A ?? process.env.DATABASE_URL;
  const urlB = process.env.DB_B;
  const aLabel = process.env.A_LABEL ?? "A";
  const bLabel = process.env.B_LABEL ?? "B";

  if (!urlA) {
    console.error("✖ DB_A тохируулаагүй байна.");
    console.error("  DB_A=<url> [DB_B=<url>] node --import tsx scripts/schema-diff.ts");
    process.exit(1);
  }

  console.log(`\n${aLabel} руу холбогдож байна…`);
  const clientA = await connectDb(urlA);

  // Нэг сан — зөвхөн диск дэх migration-тай харьцуулна.
  if (!urlB) {
    const applied = await fetchSection(clientA, SECTIONS[SECTIONS.length - 1]);
    const drift = compareWithDisk(applied, aLabel);
    await clientA.end();
    console.log(
      drift === 0
        ? "\n✅ Зөрүүгүй.\n"
        : `\n⚠ ${drift} зөрүү олдлоо.\n`,
    );
    return;
  }

  console.log(`${bLabel} руу холбогдож байна…`);
  const clientB = await connectDb(urlB);

  let total = 0;
  for (const section of SECTIONS) {
    const [a, b] = await Promise.all([
      fetchSection(clientA, section),
      fetchSection(clientB, section),
    ]);
    total += compare(section.title, a, b, aLabel, bLabel);
  }

  await Promise.all([clientA.end(), clientB.end()]);

  console.log(
    total === 0
      ? `\n✅ ${aLabel} ба ${bLabel} schema-гийн хувьд ИЖИЛ.\n`
      : `\n⚠ Нийт ${total} зөрүү. Дээрх жагсаалтыг шалгана уу.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
