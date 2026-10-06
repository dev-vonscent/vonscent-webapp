/**
 * Нэг Supabase project-ийн ДАТАГ нөгөө рүү бүрэн хуулна (schema биш, дата).
 *
 *   pnpm db:clone-catalog-dev        # prod → dev, CONFIRM_DST=<dev-ref> шаардана
 *
 *   SRC_ENV=.env.prod DST_ENV=.env.dev CONFIRM_DST=<dst-project-ref> \
 *     node --import tsx scripts/db-clone.ts [--full]
 *
 * Хэрэглээ: dev орчныг production-ий бодит каталогоор дүүргэх. Ингэснээр
 * dev дээрх UI/UX тест жинхэнэ бараа, үнэ, нөөц, зураг дээр ажиллана.
 *
 * Өгөгдмөл горим — ЗӨВХӨН КАТАЛОГ. Release-ээс (2026-10-01) хойш prod-ын
 * хэрэглэгч, захиалга бүгд бодит хүмүүсийн хувийн дата (утас, хаяг, захиалгын
 * түүх) тул dev шиг сул хамгаалалттай орчинд хуулахгүй. Хүснэгт бүрийг
 * доорх гурван жагсаалтын аль нэгэнд ЗААВАЛ ангилна (`CATALOG_TABLES`,
 * `CLEAR_TABLES`, `KEEP_TABLES`); ангилагдаагүй хүснэгт олдвол script
 * зогсоно — шинэ хүснэгт хувийн дата агуулж байж магадгүй тул чимээгүй
 * хуулахаас сэргийлнэ.
 *
 * Хүлээн авагчийн бүртгэлүүд (`auth.users`, `profiles`, хаяг) ХЭВЭЭР үлдэнэ —
 * dev-ийн тест хэрэглэгч, admin эрх алга болохгүй. Харин тэдний захиалга,
 * сэтгэгдэл, хүслийн жагсаалт зэрэг нь хуучин бараа руу заадаг тул устана.
 *
 * `--full`: хуучин горим — `auth.users`-аас эхлээд БҮХ датаг хуулна.
 * Зөвхөн хоёр тал хоёулаа тестийн дататай үед (prod → prod-ын хуулбар биш).
 *
 * ⚠️ ХҮЛЭЭН АВАГЧ САНГИЙН КАТАЛОГ (--full үед БҮХ) МӨРИЙГ УСТГАНА. Тиймээс:
 *   • `CONFIRM_DST` нь хүлээн авагчийн project ref-тэй ЯГ таарах ёстой —
 *     өөр сан руу андуурч заахаас сэргийлнэ;
 *   • эхлээд хүлээн авагчийн одоогийн датаг `backups/`-д хуулна;
 *   • `drop` / `truncate` ХЭРЭГЛЭХГҮЙ — зөвхөн `delete`. Schema, функц,
 *     trigger, RLS policy, pg_cron job бүгд хөндөгдөхгүй.
 *
 * Яагаад `session_replication_role = replica` вэ: trigger ба FK шалгалтыг
 * тухайн session-д унтраадаг. Ингэснээр (а) хүснэгтийн дарааллыг тааруулах
 * шаардлагагүй, (б) `reviews` оруулахад rating trigger дахин ажиллаж
 * `products.rating_avg`-ийг хуулсан утган дээр давхар тооцохгүй, (в)
 * `profiles` оруулахад role claim trigger `auth.users`-ыг дарж бичихгүй.
 * Supabase-ийн `postgres` role-д энэ эрх өгөгдсөн (superuser биш ч).
 *
 * Зураг: объектын файлууд өөр bucket-д байгаа тул `scripts/storage-clone.ts`-ийг
 * ДАРАА нь ажиллуулна. Энэ script нь URL дэх host-ыг сольж бичих хэсгийг
 * гүйцэтгэдэг (upload үед бүтэн URL багананд хадгалагддаг тул шаардлагатай).
 */
import { resolveDb } from "./db";
import { spawnSync, spawn } from "node:child_process";
import {
  mkdirSync,
  createWriteStream,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";

/** `auth` схемээс хуулах хүснэгтүүд. Сесс/токеныг хуулахгүй — тэд түр зуурын. */
const AUTH_TABLES = ["auth.users", "auth.identities"];

/**
 * Каталог горимд эх сурвалжаас хуулах хүснэгтүүд (ALLOWLIST). `null` = бүх мөр,
 * string = `where` нөхцөл. Шүүлт нь хэрэглэгчтэй холбоотой мөрийг таслана:
 * хэрэглэгчийн угсарсан багц, хувийн/шагналын купон, захиалгын буцаалтын
 * нөөцийн мөр.
 */
const BASE_COLLECTIONS =
  "collection_id in (select id from public.collections where user_id is null)";
const CATALOG_TABLES: Record<string, string | null> = {
  brands: null,
  concentrations: null,
  scent_families: null,
  tags: null,
  custom_tags: null,
  note_translations: null,
  products: null,
  product_variants: null,
  product_images: null,
  product_tags: null,
  product_custom_tags: null,
  product_image_generations: null,
  inventory: null,
  bottle_stock: null,
  restock_log: "order_id is null",
  collections: "user_id is null",
  collection_items: BASE_COLLECTIONS,
  collection_tags: BASE_COLLECTIONS,
  collection_custom_tags: BASE_COLLECTIONS,
  collection_ml_discounts: BASE_COLLECTIONS,
  collection_image_generations: BASE_COLLECTIONS,
  home_sections: null,
  home_section_products: null,
  blog_posts: null,
  faqs: null,
  settings: null,
  spin_wheel_prizes: null,
  coupons: "user_id is null and source_order_id is null",
};

/**
 * Хуулахгүй, гэхдээ хүлээн авагч дээр УСТГАНА — хэрэглэгчийн үйлдэл бөгөөд
 * солигдох гэж буй бараа/багц/захиалга руу заадаг тул үлдвэл өнчирнө.
 */
const CLEAR_TABLES = [
  "orders",
  "order_items",
  "order_status_history",
  "order_requests",
  "order_refund_accounts",
  "qpay_invoices",
  "qpay_payments",
  "admin_notifications",
  "coupon_redemptions",
  "loyalty_ledger",
  "spin_wheel_spins",
  "reviews",
  "wishlists",
  "collection_wishlists",
];

/** Хүлээн авагч дээр ХӨНДӨХГҮЙ — dev-ийн өөрийн бүртгэл, түр зуурын дата. */
const KEEP_TABLES = [
  // scripts/migrate.ts-ийн бүртгэл — хөндвөл migration дахин ажиллана.
  "_app_migrations",
  "profiles",
  "addresses",
  "newsletter_subscribers",
  "verify_mn_sessions",
  "phone_login_attempts",
  "contact_messages",
  "rate_limits",
];

/**
 * Хуулсны дараах засвар. Каталогийн мөрүүд эх сурвалжийн admin (profiles),
 * захиалга, сэтгэгдэл дээр тулгуурласан утгыг агуулдаг — хүлээн авагчид
 * тэдгээр байхгүй тул тэглэнэ.
 */
const CATALOG_FIXUPS = [
  // Эх сурвалжийн admin-ий profile id — хүлээн авагчид байхгүй.
  "update public.bottle_stock set updated_by = null where updated_by is not null",
  "update public.note_translations set updated_by = null where updated_by is not null",
  "update public.restock_log set created_by = null where created_by is not null",
  // Захиалгын түгжээ: тэр захиалгууд хуулагдаагүй тул ml дэмий түгжигдэнэ.
  "update public.inventory set reserved_ml = 0, is_sold_out = on_hand_ml <= 0",
  // Сэтгэгдэл хуулагдаагүй.
  "update public.products set rating_avg = 0, rating_count = 0",
  "update public.collections set rating_avg = 0, rating_count = 0",
  // coupon_redemptions хуулагдаагүй.
  "update public.coupons set used_count = 0",
  // Захиалга дээр тулгуурласан «Эрэлттэй» тагийг хүлээн авагчийн датаар дахин бодно.
  "select public.refresh_hot_tag()",
  // Захиалга бүгд устсан тул V-point-ийн түүх ч алга — үлдэгдлийг тэглэнэ.
  "update public.profiles set loyalty_points = 0, pending_points = 0 where loyalty_points <> 0 or pending_points <> 0",
];

function envFileUrl(file: string): string {
  if (!existsSync(file)) {
    console.error(`✖ ${file} байхгүй.`);
    process.exit(1);
  }
  // node --env-file-тэй ижил хэлбэрээр уншина (inline # тайлбарыг таслана).
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const m = /^DATABASE_URL=(.*)$/u.exec(line);
    if (m) return m[1].replace(/\s+#.*$/u, "").trim();
  }
  console.error(`✖ ${file}-д DATABASE_URL алга.`);
  process.exit(1);
}

function refOf(url: string): string {
  return /db\.([a-z0-9]+)\.supabase\.co/u.exec(url)?.[1] ?? "";
}

function run(cmd: string, args: string[], label: string) {
  const res = spawnSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (res.status !== 0) {
    console.error(`✖ ${label} амжилтгүй (exit ${res.status}).`);
    process.exit(1);
  }
}

/** pg_dump-ийн гаралтыг файл руу урсгана. */
async function dumpToFile(
  args: string[],
  out: string,
  label: string,
): Promise<void> {
  console.log(`  ${label} → ${out}`);
  const file = createWriteStream(out);
  const code = await new Promise<number>((resolve) => {
    const child = spawn("pg_dump", args, {
      stdio: ["ignore", "pipe", "inherit"],
    });
    child.stdout.pipe(file);
    child.on("close", resolve);
  });
  if (code !== 0) {
    console.error(`✖ ${label} амжилтгүй (exit ${code}).`);
    process.exit(1);
  }
}

/**
 * Зургийн URL дэх project host-ыг эх сурвалжаас хүлээн авагч руу сольж бичнэ.
 *
 * Зургийн бүтэн URL нь upload үед багананд хадгалагддаг
 * (`src/lib/storage/storage.ts` `publicUrl()`), тиймээс хуулсан мөрүүд эх
 * сурвалжийн host руу заасаар байна. `next/image`-ийн зөвшөөрөгдсөн host нь
 * `NEXT_PUBLIC_SUPABASE_URL`-аас гардаг (`next.config.ts`) тул сольж бичихгүй
 * бол бүх зураг татгалзагдана.
 */
async function rewriteHost(
  client: Client,
  srcRef: string,
  dstRef: string,
): Promise<void> {
  const srcHost = `${srcRef}.supabase.co`;
  const dstHost = `${dstRef}.supabase.co`;

  // Ямар ч text багана эх сурвалжийн host-ыг агуулж байвал олно — гараар
  // жагсаалт хөтлөхөөс найдвартай (шинэ багана нэмэгдвэл ч барина).
  //
  // `is_generated = 'NEVER'` нь ЗАЙЛШГҮЙ: `search_text` мэт баганууд
  // `generated always as (search_normalize(...)) stored` тул тэднийг update
  // хийхэд Postgres 428C9 («can only be updated to DEFAULT») гэж татгалздаг.
  // Эдгээр нь эх багананаасаа өөрөө дахин тооцогддог тул гар хүрэх шаардлага
  // ч байхгүй — эх баганыг зассанаар өөрсдөө шинэчлэгдэнэ.
  const { rows: cols } = await client.query<{
    table_name: string;
    column_name: string;
  }>(`
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.data_type in ('text', 'character varying')
       and c.is_generated = 'NEVER'
       and c.is_updatable = 'YES'
     order by 1, 2
  `);

  let rewritten = 0;
  const skipped: string[] = [];
  for (const { table_name, column_name } of cols) {
    // Нэг багана болохгүй байсан ч бүх ажлыг зогсоохгүй — алгасаад тайлагдана.
    try {
      const r = await client.query(
        `update public."${table_name}"
            set "${column_name}" = replace("${column_name}", $1, $2)
          where "${column_name}" like '%' || $1 || '%'`,
        [srcHost, dstHost],
      );
      if (r.rowCount) {
        console.log(`  ${table_name}.${column_name}: ${r.rowCount}`);
        rewritten += r.rowCount;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      skipped.push(`${table_name}.${column_name} — ${msg}`);
    }
  }
  console.log(`  нийт ${rewritten} мөр шинэчлэгдлээ`);
  if (skipped.length) {
    console.log(`\n  ⚠ ${skipped.length} багана алгаслаа:`);
    for (const s of skipped) console.log(`    ${s}`);
  }

  // «Ажиллалаа» нь «бүрэн болсон» гэсэн үг биш — эх сурвалжийн host хаа нэгтээ
  // үлдсэн эсэхийг шалгана. Үлдвэл зураг эвдэрнэ (next/image host-ыг барина).
  const leftover = await client.query<{ t: string; c: string; n: string }>(
    cols
      .map(
        ({ table_name, column_name }) =>
          `select '${table_name}' t, '${column_name}' c, count(*)::text n
             from public."${table_name}"
            where "${column_name}" like '%${srcHost}%'`,
      )
      .join(" union all "),
  );
  const stillThere = leftover.rows.filter((r) => r.n !== "0");
  if (stillThere.length) {
    console.log(`\n  ⚠ Эх сурвалжийн host үлдсэн газрууд:`);
    for (const r of stillThere) console.log(`    ${r.t}.${r.c}: ${r.n}`);
  } else {
    console.log(`  ✓ ${srcHost} хаана ч үлдсэнгүй`);
  }
}

/** public схемийн бүх BASE TABLE-ийн нэр. */
async function publicTables(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ t: string }>(`
    select table_name as t
      from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  `);
  return rows.map((r) => r.t);
}

/** Хүснэгтийн бичигдэх (generated биш) баганууд, ordinal дарааллаар. */
async function writableColumns(
  client: Client,
  table: string,
): Promise<string[]> {
  const { rows } = await client.query<{ c: string }>(
    `select column_name as c
       from information_schema.columns
      where table_schema = 'public' and table_name = $1
        and is_generated = 'NEVER'
      order by ordinal_position`,
    [table],
  );
  return rows.map((r) => r.c);
}

/**
 * Хүснэгт бүр гурван жагсаалтын аль нэгэнд байгаа, хоёр талд ижил багануудтай
 * эсэхийг шалгана. Алдаа байвал юу ч хөндөхөөс ӨМНӨ зогсоно.
 */
async function checkClassification(
  srcClient: Client,
  dstClient: Client,
): Promise<Record<string, string[]>> {
  const known = new Set([
    ...Object.keys(CATALOG_TABLES),
    ...CLEAR_TABLES,
    ...KEEP_TABLES,
  ]);
  const [srcTables, dstTables] = await Promise.all([
    publicTables(srcClient),
    publicTables(dstClient),
  ]);
  const problems: string[] = [];
  for (const t of new Set([...srcTables, ...dstTables])) {
    if (!known.has(t)) problems.push(`ангилагдаагүй хүснэгт: ${t}`);
  }
  for (const t of known) {
    if (!dstTables.includes(t)) problems.push(`хүлээн авагчид алга: ${t}`);
    if (!srcTables.includes(t)) problems.push(`эх сурвалжид алга: ${t}`);
  }

  const columns: Record<string, string[]> = {};
  for (const t of Object.keys(CATALOG_TABLES)) {
    if (!srcTables.includes(t) || !dstTables.includes(t)) continue;
    const [s, d] = await Promise.all([
      writableColumns(srcClient, t),
      writableColumns(dstClient, t),
    ]);
    const missing = d.filter((c) => !s.includes(c));
    const extra = s.filter((c) => !d.includes(c));
    if (missing.length || extra.length) {
      problems.push(
        `${t}: багана зөрүүтэй (эх сурвалжид алга: [${missing.join(", ")}], хүлээн авагчид алга: [${extra.join(", ")}])`,
      );
    }
    columns[t] = d;
  }

  if (problems.length) {
    console.error(`\n✖ Хуулахаас өмнөх шалгалт унав:`);
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      `\n  Шинэ хүснэгтийг CATALOG_TABLES / CLEAR_TABLES / KEEP_TABLES-ийн аль\n` +
        `  нэгэнд нэмнэ үү. Багана зөрвөл эхлээд migration-ийг хоёр талд\n` +
        `  тэнцүүлнэ (pnpm db:migrate-dev, scripts/schema-diff.ts).\n`,
    );
    process.exit(1);
  }
  return columns;
}

/**
 * Каталог горим: хэрэглэгчийн датаг хуулахгүйгээр каталогийг солино.
 *
 * pg_dump биш `\copy (select …)` — pg_dump мөр шүүж чаддаггүй тул хэрэглэгчийн
 * багц, хувийн купон зэрэг нь дор хаяж локал файлд буух байсан. `\copy` нь
 * шүүсэн мөрийг л эх сурвалжаас гаргана.
 *
 * Устгал + restore + засвар бүгд psql-ийн НЭГ transaction дотор: аль нэг
 * алхам унавал хүлээн авагч огт өөрчлөгдөхгүй.
 */
async function catalogClone(
  srcUrl: string,
  dstUrl: string,
  columns: Record<string, string[]>,
  tmp: string,
): Promise<void> {
  const tables = Object.keys(CATALOG_TABLES);
  const fileOf = (t: string) => join(tmp, `${t}.copy`);
  const colList = (t: string) => columns[t].map((c) => `"${c}"`).join(", ");

  console.log("\n[3/6] Эх сурвалжаас каталог татаж байна (зөвхөн уншилт)…");
  const exportSql = join(tmp, "export.sql");
  writeFileSync(
    exportSql,
    `\\set ON_ERROR_STOP on\n` +
      `begin transaction isolation level repeatable read read only;\n` +
      tables
        .map((t) => {
          const where = CATALOG_TABLES[t] ? ` where ${CATALOG_TABLES[t]}` : "";
          return `\\copy (select ${colList(t)} from public."${t}"${where}) to '${fileOf(t)}'`;
        })
        .join("\n") +
      `\ncommit;\n`,
    "utf8",
  );
  run("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-f", exportSql, srcUrl], "export");

  console.log("\n[4-5/6] Хүлээн авагч дээр солиж байна (нэг transaction)…");
  const importSql = join(tmp, "import.sql");
  writeFileSync(
    importSql,
    `\\set ON_ERROR_STOP on\n` +
      `begin;\n` +
      // FK, trigger-ийг унтраана — дарааллаас үл хамаарна, rating/tag
      // trigger-үүд хуулсан утгыг давхар тооцохгүй (header-ийг үз).
      `set local session_replication_role = replica;\n` +
      [...CLEAR_TABLES, ...tables]
        .map((t) => `delete from public."${t}";`)
        .join("\n") +
      "\n" +
      tables
        .map((t) => `\\copy public."${t}" (${colList(t)}) from '${fileOf(t)}'`)
        .join("\n") +
      `\nset local session_replication_role = origin;\n` +
      CATALOG_FIXUPS.map((s) => `${s};`).join("\n") +
      `\ncommit;\n`,
    "utf8",
  );
  run("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-f", importSql, dstUrl], "import");

  for (const t of tables) rmSync(fileOf(t));
}

/** Хуулсан хүснэгтүүдийн мөрийн тоог хоёр талд харьцуулж хэвлэнэ. */
async function reportCounts(srcClient: Client, dstClient: Client) {
  console.log("\n  хүснэгт                         эх → хүлээн авагч");
  for (const [t, where] of Object.entries(CATALOG_TABLES)) {
    const q = `select count(*)::int as n from public."${t}"${where ? ` where ${where}` : ""}`;
    const [s, d] = await Promise.all([
      srcClient.query<{ n: number }>(q),
      dstClient.query<{ n: number }>(`select count(*)::int as n from public."${t}"`),
    ]);
    const mark = s.rows[0].n === d.rows[0].n ? " " : "✖";
    console.log(
      `  ${mark} ${t.padEnd(30)} ${String(s.rows[0].n).padStart(5)} → ${d.rows[0].n}`,
    );
  }
}

async function main() {
  const srcEnv = process.env.SRC_ENV ?? ".env.prod";
  const dstEnv = process.env.DST_ENV ?? ".env.dev";
  const confirm = process.env.CONFIRM_DST ?? "";
  const rewriteOnly = process.argv.includes("--rewrite-only");
  const full = process.argv.includes("--full");

  const srcUrl = envFileUrl(srcEnv);
  const dstUrl = envFileUrl(dstEnv);
  const srcRef = refOf(srcUrl);
  const dstRef = refOf(dstUrl);

  console.log(`\nЭх сурвалж (уншина): ${srcRef}   [${srcEnv}]`);
  console.log(`Хүлээн авагч (БИЧНЭ): ${dstRef}   [${dstEnv}]`);
  console.log(
    full
      ? `Горим: --full (хэрэглэгч, захиалга ХАМТ)`
      : `Горим: зөвхөн каталог (хэрэглэгч, захиалга хуулахгүй)`,
  );

  if (!srcRef || !dstRef) {
    console.error("\n✖ Project ref-ийг DATABASE_URL-аас уншиж чадсангүй.");
    process.exit(1);
  }
  if (srcRef === dstRef) {
    console.error("\n✖ Эх сурвалж ба хүлээн авагч ижил сан байна.");
    process.exit(1);
  }
  if (confirm !== dstRef) {
    console.error(
      `\n✖ CONFIRM_DST тохирохгүй.\n` +
        `  Хүлээн авагчийн ${full ? "бүх" : "каталог, захиалгын"} мөрийг устгах гэж байна. Батлахын тулд:\n` +
        `    CONFIRM_DST=${dstRef}\n`,
    );
    process.exit(1);
  }

  mkdirSync("backups", { recursive: true });
  const tmp = join("backups", `_clone-${dstRef}`);
  mkdirSync(tmp, { recursive: true });

  // ── Холболтуудыг шийднэ (шууд хост нь IPv6-only тул pooler руу шилжинэ) ──
  console.log("\n[1/6] Холболт шийдэж байна…");
  const src = await resolveDb(srcUrl, { verbose: false });
  const dst = await resolveDb(dstUrl, { verbose: false });

  const dstTables = await publicTables(dst.client);
  console.log(`  хүлээн авагчид ${dstTables.length} public хүснэгт`);
  // Каталог горимд ангилал/баганы шалгалтыг юу ч хөндөхөөс өмнө хийнэ.
  const columns =
    full || rewriteOnly
      ? {}
      : await checkClassification(src.client, dst.client);

  // `--rewrite-only`: дата аль хэдийн хуулагдсан, зөвхөн 6-р алхмыг гүйцээнэ.
  // Хуулбар нь дунд замд (жишээ нь generated багана дээр) зогссон үед хэрэгтэй —
  // 28 MB storage, 1000+ мөрийг дахин зөөх шаардлагагүй.
  if (rewriteOnly) {
    console.log("\n(--rewrite-only: 2-5 алхмыг алгаслаа)");
    await rewriteHost(dst.client, srcRef, dstRef);
    await Promise.all([src.client.end(), dst.client.end()]);
    console.log("\n✅ URL-ийн host сольж бичих алхам дууслаа.");
    return;
  }

  // ── Буцах цэг: хүлээн авагчийн одоогийн дата ──────────────────────────
  console.log("\n[2/6] Хүлээн авагчийн одоогийн датаг хуулж авч байна…");
  const backup = join(tmp, "before-clone-dst-data.sql");
  await dumpToFile(
    [
      dst.url,
      "--data-only",
      "--schema=public",
      "--no-owner",
      "--no-privileges",
    ],
    backup,
    "хүлээн авагч (өмнөх)",
  );

  if (!full) {
    await catalogClone(src.url, dst.url, columns, tmp);
    await reportCounts(src.client, dst.client);
    console.log("\n[6/6] Зургийн URL-ийн host-ыг сольж байна…");
    await rewriteHost(dst.client, srcRef, dstRef);
    await Promise.all([src.client.end(), dst.client.end()]);
    console.log(`\n✅ Каталог хуулбарлагдлаа: ${srcRef} → ${dstRef}`);
    console.log(`   Буцах цэг: ${backup}`);
    console.log(
      `\n⚠️  Зургийн ФАЙЛУУД хараахан хуулагдаагүй. Дараагийн алхам:\n` +
        `   SRC_ENV=${srcEnv} DST_ENV=${dstEnv} node --import tsx scripts/storage-clone.ts\n`,
    );
    return;
  }

  // ── Эх сурвалжаас дата татна ─────────────────────────────────────────
  console.log("\n[3/6] Эх сурвалжаас дата татаж байна (зөвхөн уншилт)…");
  const publicDump = join(tmp, "src-public-data.sql");
  await dumpToFile(
    [
      src.url,
      "--data-only",
      "--schema=public",
      "--no-owner",
      "--no-privileges",
    ],
    publicDump,
    "public дата",
  );

  const authDump = join(tmp, "src-auth-data.sql");
  await dumpToFile(
    [
      src.url,
      "--data-only",
      ...AUTH_TABLES.map((t) => `--table=${t}`),
      "--no-owner",
      "--no-privileges",
    ],
    authDump,
    "auth.users + auth.identities",
  );

  // ── Хүлээн авагчийн мөрүүдийг устгана (delete, truncate БИШ) ─────────
  console.log("\n[4/6] Хүлээн авагчийн мөрүүдийг устгаж байна…");
  await dst.client.query("set session_replication_role = replica");
  await dst.client.query("begin");
  try {
    for (const t of dstTables) {
      const r = await dst.client.query(`delete from public."${t}"`);
      if (r.rowCount) console.log(`  − public.${t}: ${r.rowCount}`);
    }
    for (const t of [...AUTH_TABLES].reverse()) {
      const r = await dst.client.query(`delete from ${t}`);
      if (r.rowCount) console.log(`  − ${t}: ${r.rowCount}`);
    }
    await dst.client.query("commit");
  } catch (e) {
    await dst.client.query("rollback").catch(() => {});
    console.error(`✖ Устгах үед алдаа: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  // ── Restore ──────────────────────────────────────────────────────────
  // psql-ийн ЦОРЫН ГАНЦ session дотор replica role тавьж, дараа нь dump-уудыг
  // уншина. Нэг мөр алдаа гарвал шууд зогсоно (ON_ERROR_STOP).
  console.log("\n[5/6] Хүлээн авагч руу restore хийж байна…");
  const wrapper = join(tmp, "restore.sql");
  // `\i`-д замыг хашилтгүй бичнэ — psql-ийн meta-команд давхар хашилтыг
  // файлын нэр гэж уншдаггүй. Замд зай байхгүй (backups/_clone-<ref>/…).
  writeFileSync(
    wrapper,
    `\\set ON_ERROR_STOP on\n` +
      `set session_replication_role = replica;\n` +
      `\\i ${authDump}\n` +
      `\\i ${publicDump}\n` +
      `set session_replication_role = origin;\n`,
    "utf8",
  );
  run(
    "psql",
    ["-v", "ON_ERROR_STOP=1", "-q", "-f", wrapper, dst.url],
    "psql restore",
  );

  // ── Зургийн URL дэх host-ыг сольж бичих ──────────────────────────────
  // Зургийн бүтэн URL нь upload үед багананд хадгалагддаг
  // (src/lib/storage/storage.ts publicUrl()). Хуулсан мөрүүд эх сурвалжийн
  // host руу заасаар байх тул next/image тэднийг ХҮЛЭЭН АВАХГҮЙ:
  // remotePatterns нь NEXT_PUBLIC_SUPABASE_URL-аас гардаг (next.config.ts).
  console.log("\n[6/6] Зургийн URL-ийн host-ыг сольж байна…");
  await rewriteHost(dst.client, srcRef, dstRef);

  await Promise.all([src.client.end(), dst.client.end()]);

  console.log(`\n✅ Дата хуулбарлагдлаа: ${srcRef} → ${dstRef}`);
  console.log(`   Буцах цэг: ${backup}`);
  console.log(
    `\n⚠️  Зургийн ФАЙЛУУД хараахан хуулагдаагүй. Дараагийн алхам:\n` +
      `   SRC_ENV=${srcEnv} DST_ENV=${dstEnv} node --import tsx scripts/storage-clone.ts\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
