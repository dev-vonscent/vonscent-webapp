/**
 * Нэг Supabase project-ийн ДАТАГ нөгөө рүү бүрэн хуулна (schema биш, дата).
 *
 *   SRC_ENV=.env.von.prd DST_ENV=.env CONFIRM_DST=<dst-project-ref> \
 *     node --import tsx scripts/db-clone.ts
 *
 * Хэрэглээ: preview орчныг production-ий бодит датагаар дүүргэх. Ингэснээр
 * preview дээрх UI/UX тест жинхэнэ каталог, жинхэнэ захиалгын төлөв дээр
 * ажиллана.
 *
 * ⚠️ RELEASE ХИЙСНИЙ ДАРАА PROD → PREVIEW ЧИГЛЭЛД БҮҮ АЖИЛЛУУЛ.
 * Энэ script бүх датаг хуулдаг — `auth.users`, `orders`, `addresses`,
 * `profiles`, өөрөөр хэлбэл хэрэглэгчийн утас, хаяг, захиалгын түүх хамт.
 * Сайт ажиллаж эхэлсний дараа тэр нь бодит хүмүүсийн хувийн дата болох тул
 * preview шиг сул хамгаалалттай орчинд хуулах нь буруу. Тэр үед каталогийн
 * хүснэгтүүдийг л хуулдаг болгож хязгаарлах хэрэгтэй (`brands`, `products`,
 * `product_variants`, `product_images`, `inventory`, tag/collection холбоос,
 * `blog_posts`, `faqs`, `settings`) — `collections`-ийг `type = 'base'`-ээр
 * шүүнэ, эс бөгөөс `user_id → profiles → auth.users` дагаж хэрэглэгч орно.
 *
 * Одоогоор (release-ээс өмнө) prod дээрх дата нь бүхэлдээ тестийн дата тул
 * бүрэн хуулбарлах нь зүйтэй.
 *
 * ⚠️ ХҮЛЭЭН АВАГЧ САНГИЙН БҮХ МӨРИЙГ УСТГАНА. Тиймээс:
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
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";

/** `auth` схемээс хуулах хүснэгтүүд. Сесс/токеныг хуулахгүй — тэд түр зуурын. */
const AUTH_TABLES = ["auth.users", "auth.identities"];

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

async function main() {
  const srcEnv = process.env.SRC_ENV ?? ".env.von.prd";
  const dstEnv = process.env.DST_ENV ?? ".env";
  const confirm = process.env.CONFIRM_DST ?? "";
  const rewriteOnly = process.argv.includes("--rewrite-only");

  const srcUrl = envFileUrl(srcEnv);
  const dstUrl = envFileUrl(dstEnv);
  const srcRef = refOf(srcUrl);
  const dstRef = refOf(dstUrl);

  console.log(`\nЭх сурвалж (уншина): ${srcRef}   [${srcEnv}]`);
  console.log(`Хүлээн авагч (БИЧНЭ): ${dstRef}   [${dstEnv}]`);

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
        `  Хүлээн авагчийн бүх мөрийг устгах гэж байна. Батлахын тулд:\n` +
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
    "preview (өмнөх)",
  );

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
