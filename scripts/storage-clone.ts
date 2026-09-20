/**
 * Supabase Storage-ийн объектуудыг нэг project-оос нөгөө рүү хуулна.
 *
 *   SRC_ENV=.env.von.prd DST_ENV=.env node --import tsx scripts/storage-clone.ts
 *
 * `scripts/db-clone.ts`-ийн ДАРАА ажиллуулна: тэр нь `product_images.url` дэх
 * host-ыг хүлээн авагч руу сольчихсон байдаг, гэхдээ файлууд нь хуулагдаагүй
 * тул тэр хооронд зураг 404 өгнө.
 *
 * Объектын жагсаалтыг Storage API-аар биш, `storage.objects` хүснэгтээс шууд
 * уншина: API-ийн `list()` нь фолдер тус бүрээр хуудаслаж ажилладаг тул
 * гүн мөчирлөсөн зам (`products/<slug>/<uuid>.webp`) дээр тойрог их болно.
 *
 * Байгаа объектыг дахин бичихгүй (`upsert: false`) — дахин ажиллуулахад
 * зөвхөн дутууг нөхнө. `--force` өгвөл бүгдийг дарж бичнэ.
 */
import { connectDb } from "./db";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

/** Зэрэг хуулах тоо. Supabase-ийн rate limit-д хүрэхгүй, гэхдээ хурдан. */
const CONCURRENCY = 8;

interface Env {
  url: string;
  serviceKey: string;
  dbUrl: string;
  bucket: string;
  ref: string;
}

function readEnv(file: string): Env {
  if (!existsSync(file)) {
    console.error(`✖ ${file} байхгүй.`);
    process.exit(1);
  }
  const vars: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (m) vars[m[1]] = m[2].replace(/\s+#.*$/u, "").trim();
  }
  const url = vars.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = vars.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const dbUrl = vars.DATABASE_URL ?? "";
  if (!url || !serviceKey || !dbUrl) {
    console.error(
      `✖ ${file}-д NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL гурвуулаа байх ёстой.`,
    );
    process.exit(1);
  }
  return {
    url,
    serviceKey,
    dbUrl,
    bucket: vars.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "product-images",
    ref: /https:\/\/([a-z0-9]+)\.supabase\.co/u.exec(url)?.[1] ?? "",
  };
}

interface Obj {
  name: string;
  mimetype: string | null;
  size: number | null;
}

async function main() {
  const force = process.argv.includes("--force");
  const src = readEnv(process.env.SRC_ENV ?? ".env.von.prd");
  const dst = readEnv(process.env.DST_ENV ?? ".env");

  console.log(`\nЭх сурвалж : ${src.ref} / ${src.bucket}`);
  console.log(`Хүлээн авагч: ${dst.ref} / ${dst.bucket}`);
  if (src.ref === dst.ref) {
    console.error("\n✖ Ижил project байна.");
    process.exit(1);
  }

  // ── Объектын жагсаалтыг эх сурвалжийн DB-ээс ────────────────────────
  const srcDb = await connectDb(src.dbUrl, false);
  const { rows: objects } = await srcDb.query<Obj>(
    `select name,
            metadata->>'mimetype' as mimetype,
            (metadata->>'size')::bigint as size
       from storage.objects
      where bucket_id = $1
      order by name`,
    [src.bucket],
  );
  await srcDb.end();

  const totalMb = (
    objects.reduce((a, o) => a + Number(o.size ?? 0), 0) / 1048576
  ).toFixed(1);
  console.log(`\nЭх сурвалжид ${objects.length} объект · ${totalMb} MB`);

  // ── Хүлээн авагчид аль хэдийн байгаа объектууд ──────────────────────
  const dstDb = await connectDb(dst.dbUrl, false);
  const { rows: existing } = await dstDb.query<{ name: string }>(
    `select name from storage.objects where bucket_id = $1`,
    [dst.bucket],
  );
  await dstDb.end();
  const have = new Set(existing.map((r) => r.name));
  console.log(`Хүлээн авагчид ${have.size} объект аль хэдийн байна`);

  const todo = force ? objects : objects.filter((o) => !have.has(o.name));
  if (todo.length === 0) {
    console.log("\n✅ Хуулах шаардлагагүй — бүгд байна.");
    return;
  }
  console.log(`Хуулах: ${todo.length}${force ? " (--force: бүгдийг дарж бичнэ)" : ""}\n`);

  const dstStorage = createClient(dst.url, dst.serviceKey, {
    auth: { persistSession: false },
  }).storage.from(dst.bucket);

  let done = 0;
  let failed = 0;
  const failures: string[] = [];

  // Эх сурвалжийн bucket нь public тул тухайн объектыг нэрээр нь татаж болно.
  const publicUrl = (name: string) =>
    `${src.url.replace(/\/+$/u, "")}/storage/v1/object/public/${src.bucket}/${name
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

  async function copyOne(o: Obj) {
    try {
      const res = await fetch(publicUrl(o.name));
      if (!res.ok) throw new Error(`татах: HTTP ${res.status}`);
      const body = new Uint8Array(await res.arrayBuffer());
      const { error } = await dstStorage.upload(o.name, body, {
        contentType: o.mimetype ?? "application/octet-stream",
        upsert: force,
      });
      if (error) throw new Error(`upload: ${error.message}`);
      done += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${o.name} — ${msg}`);
    }
    const n = done + failed;
    if (n % 25 === 0 || n === todo.length) {
      console.log(`  ${n}/${todo.length}  (✓${done} ✖${failed})`);
    }
  }

  // Тогтмол хэмжээний зэрэгцээ ажиллагаа — queue-аас нэг нэгээр авна.
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
      while (cursor < todo.length) {
        const item = todo[cursor++];
        await copyOne(item);
      }
    }),
  );

  console.log(`\n✓ хуулсан: ${done}   ✖ амжилтгүй: ${failed}`);
  if (failures.length) {
    console.log("\nАмжилтгүй болсон:");
    for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
    if (failures.length > 20) console.log(`  … нийт ${failures.length}`);
    process.exit(1);
  }
  console.log("\n✅ Storage хуулбарлагдлаа.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
