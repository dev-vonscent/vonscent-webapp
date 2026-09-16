/**
 * Алсын сангийн schema-г ФАЙЛ болгож хуулна — `supabase db dump`-ийн бүрхүүл.
 *
 *   DB_URL=<url> OUT=supabase/_snapshot/prod-schema.sql \
 *     node --import tsx scripts/schema-snapshot.ts
 *
 * ⚠️ Энэ нь migration ҮҮСГЭХГҮЙ. Гаралт нь `supabase/migrations/`-д ОРОХГҮЙ —
 * зөвхөн харьцуулах/баталгаажуулах зориулалттай snapshot. Энэ репогийн
 * migration эх сурвалж нь `supabase/migrations/*.sql` + `scripts/migrate.ts`
 * хэвээр.
 *
 * Яагаад `supabase db pull` биш вэ: CLI-ийн өөрийн тайлбараар `db pull` нь
 * «may record them in that database's migration history» — өөрөөр хэлбэл
 * алсын санд БИЧИЛТ хийнэ (`supabase_migrations.schema_migrations`). Энэ
 * репод тийм түүх байхгүй бөгөөд production дээр бичих ёсгүй. `db dump` нь
 * цэвэр `pg_dump` — зөвхөн уншина.
 *
 * Яагаад бүрхүүл хэрэгтэй вэ: `db dump` нь `pg_dump`-ыг Docker дотор
 * ажиллуулдаг ба Docker-ийн сүлжээнд IPv6 байхгүй, харин Supabase-ийн шууд
 * хост (`db.<ref>.supabase.co`) нь зөвхөн IPv6. Тиймээс `scripts/db.ts`-ээр
 * IPv4 Session pooler-ийн URI-г олоод CLI-д түүнийг дамжуулна.
 *
 * Нууцлал: шийдэгдсэн URI нь нууц үг агуулдаг тул хэзээ ч хэвлэхгүй —
 * дэд процесст аргумент болгож л дамжина.
 */
import { resolveDb } from "./db";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const url = process.env.DB_URL;
const out = process.env.OUT;
/** Таслалаар тусгаарласан схемүүд. `storage` нь bucket-ийн тодорхойлолтод. */
const schemas = process.env.SCHEMAS ?? "public,storage";

if (!url || !out) {
  console.error("✖ DB_URL ба OUT хоёуланг нь өг.");
  console.error(
    "  DB_URL=<url> OUT=supabase/_snapshot/prod-schema.sql " +
      "node --import tsx scripts/schema-snapshot.ts",
  );
  process.exit(1);
}

async function main() {
  // Docker дотроос хүрэхийн тулд шууд (IPv6) хостыг зориуд алгасана.
  console.log("IPv4 Session pooler-ийг хайж байна…");
  const { url: uri } = await resolveDb(url!, {
    verbose: false,
    skipDirect: true,
  });

  mkdirSync(dirname(out!), { recursive: true });

  const args = [
    "db",
    "dump",
    "--db-url",
    uri,
    "--schema",
    schemas,
    "-f",
    out!,
  ];
  // Аргументуудыг хэвлэхдээ нууц үгтэй URI-г нуухаар орлуулна.
  console.log(`$ supabase db dump --db-url <нуусан> --schema ${schemas} -f ${out}`);

  const res = spawnSync("supabase", args, { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`\n✖ supabase db dump амжилтгүй (exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
  console.log(`\n✅ Schema snapshot: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
