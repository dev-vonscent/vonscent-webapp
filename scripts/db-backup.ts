/**
 * Санг файл болгож хуулна (`pnpm db:backup`).
 *
 *   node --env-file=.env.local --import tsx scripts/db-backup.ts
 *
 * Яагаад скрипт болгосон бэ — `pg_dump`-ыг шууд дуудахад хоёр зүйл таардаг:
 *
 *   1. **Хувилбарын зөрүү.** `pg_dump` нь серверээсээ ХУУЧИН байвал зүгээр л
 *      татгалздаг. Энэ машин дээр homebrew-ийн 14 суусан, Supabase нь 15/17
 *      ажилладаг. Тиймээс: орон нутгийнх хүрэхгүй бол серверийн хувилбартай
 *      тохирох Docker image-ээр ажиллуулна.
 *   2. **IPv6.** Supabase-ийн шууд хост (`db.<ref>.supabase.co`) нь зөвхөн
 *      IPv6 бөгөөд Docker-ийн сүлжээнд IPv6 байхгүй. Docker-ээр явах үед
 *      холболтыг IPv4 Session pooler руу шахна (`scripts/db.ts`).
 *
 * Юуг хуулах вэ: `public` схем бүхэлдээ — бүтэц ба өгөгдөл, `_app_migrations`
 * бүртгэл ч дотроо. Supabase-ийн өөрийн удирддаг `auth` / `storage` схемийг
 * хуулахгүй (тэдгээрийг хуулахад эрх ч хүрэхгүй, буцаан тавихад ч зөрчилддөг).
 *
 * ⚠️ **Энэ нь ЯГ ЮУ вэ, юу БИШ вэ.** Энэ бол *нэг төслийн дотор* буцаж очих
 * цэг — migration буруу явсан, скрипт өгөгдөл эвдсэн үед хэрэглэнэ. Бүрэн
 * «гамшгийн сэргээлт» БИШ: `public`-ийн мөрүүд `auth.users` рүү заадаг тул
 * хэрэглэгчид нь байхгүй ХООСОН төсөл дээр буцаахад гадаад түлхүүр дээр
 * зогсоно (тэстээр батлав). Бүтэн төслийн хуулбар хэрэгтэй бол Supabase-ийн
 * Dashboard → Database → Backups-ыг ашиглана.
 */
import { resolveDb } from "./db";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, statSync, readFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.local).");
  process.exit(1);
}

/** Тушаалыг ажиллуулж stdout-ыг буцаана; амжилтгүй бол null. */
function run(cmd: string, args: string[]): string | null {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return res.status === 0 ? String(res.stdout) : null;
}

/** Орон нутгийн `pg_dump`-ийн үндсэн хувилбар, эсвэл суугаагүй бол null. */
function localPgDumpMajor(): number | null {
  const out = run("pg_dump", ["--version"]);
  if (!out) return null;
  const m = /(\d+)\./u.exec(out);
  return m ? Number(m[1]) : null;
}

function hasDocker(): boolean {
  return run("docker", ["info", "--format", "{{.ServerVersion}}"]) !== null;
}

async function main() {
  // Эхлээд серверийн хувилбарыг мэдэх хэрэгтэй — ямар `pg_dump` хэрэгтэйг
  // тэр шийднэ. Шууд хостоор холбогдож болно (энэ нь зөвхөн уншилт).
  const probe = await resolveDb(url!, { verbose: false });
  const { rows } = await probe.client.query<{
    v: string;
    db: string;
    size: string;
  }>(
    "select current_setting('server_version') as v, current_database() as db," +
      " pg_size_pretty(pg_database_size(current_database())) as size",
  );
  await probe.client.end().catch(() => {});
  const serverMajor = Number(/^(\d+)/u.exec(rows[0].v)?.[1]);
  console.log(`Сан: ${rows[0].db} · PostgreSQL ${rows[0].v} · ${rows[0].size}`);

  const local = localPgDumpMajor();
  const useLocal = local !== null && local >= serverMajor;
  if (!useLocal && !hasDocker()) {
    console.error(
      `✖ pg_dump ${serverMajor}+ хэрэгтэй (орон нутагт ${local ?? "алга"}), Docker ч ажиллахгүй байна.\n` +
        `  Аль нэгийг нь: brew install postgresql@${serverMajor}  ЭСВЭЛ  Docker Desktop-оо асаа.`,
    );
    process.exit(1);
  }

  // Docker-оор явах бол шууд хост (IPv6) хүрэхгүй тул pooler руу шахна.
  const conn = useLocal
    ? probe
    : await resolveDb(url!, { verbose: false, skipDirect: true });
  if (conn !== probe) await conn.client.end().catch(() => {});

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-").slice(0, 19);
  const out = join("backups", `${stamp}-public.sql`);

  const dumpArgs = [
    conn.url,
    "--schema=public",
    // Supabase дээр объектуудын эзэмшигч/эрх нь платформынх — буцаан тавихад
    // тэдгээр мөрүүд зөвхөн алдаа өгнө.
    "--no-owner",
    "--no-privileges",
    // `--clean` ЗОРИУДААР алга. Тэр нь dump-ийн эхэнд `DROP SCHEMA IF EXISTS
    // public` гэж бичдэг — нэг мөрөнд нуугдсан, файлыг нээж уншаагүй хүнд
    // харагдахгүй эрсдэл. Дээр нь dump-д ороогүй ямар нэг объект public
    // дотор байвал (өөр өргөтгөл г.м.) тэр DROP бүтэлгүйтээд буцаалт хагас
    // дундуураа зогсоно. Устгах шийдвэрийг доорх зааварт ил гаргав.
  ];

  const [cmd, args] = useLocal
    ? (["pg_dump", dumpArgs] as const)
    : ([
        "docker",
        [
          "run",
          "--rm",
          "-i",
          `postgres:${serverMajor}-alpine`,
          "pg_dump",
          ...dumpArgs,
        ],
      ] as const);

  console.log(
    `${useLocal ? "Орон нутгийн" : `Docker (postgres:${serverMajor})`} pg_dump → ${out}`,
  );

  const file = createWriteStream(out);
  const code = await new Promise<number>((resolve) => {
    const child = spawn(cmd, args as string[], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    child.stdout.pipe(file);
    child.on("close", resolve);
  });
  if (code !== 0) {
    console.error(`✖ pg_dump ${code} кодоор зогслоо. ${out}-г бүү ашигла.`);
    process.exit(1);
  }

  // «Файл үүссэн» нь «backup бүрэн» гэсэн үг биш: сүлжээ тасарсан dump ч
  // файл үлдээдэг. pg_dump төгсгөлдөө үргэлж энэ мөрийг бичдэг.
  const tail = readFileSync(out, "utf8").slice(-200);
  if (!tail.includes("PostgreSQL database dump complete")) {
    console.error(`✖ ${out} дутуу байна (төгсгөлийн тэмдэг алга).`);
    process.exit(1);
  }

  const mb = (statSync(out).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Бэлэн: ${out} (${mb} MB)`);
  console.log(
    `\nБуцаан тавих (ЗӨВХӨН хэрэг гарвал). Эхний тушаал нь public схемийг\n` +
      `бүхэлд нь УСТГАНА — өнөөдрийн бүх өгөгдөл алга болж, ${out}-ийн\n` +
      `агшин руу буцна:\n\n` +
      `  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \\\n` +
      `    -c 'drop schema public cascade' \\\n` +
      `    -f ${out}\n\n` +
      `(Схемийг дахин үүсгэх шаардлагагүй — dump өөрөө CREATE SCHEMA\n` +
      `public мөрөөс эхэлдэг.)\n\n` +
      `Энэ нь ТУХАЙН төслийн дотор буцаах зориулалттай — хэрэглэгчид нь\n` +
      `байхгүй өөр төсөл дээр буцаавал auth.users руу заасан гадаад\n` +
      `түлхүүр дээр зогсоно. Бүтэн хуулбарыг Supabase Dashboard →\n` +
      `Database → Backups-аас авна.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
