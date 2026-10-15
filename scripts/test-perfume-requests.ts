/**
 * Үнэртний саналын RPC-ийн integration тест (0137_perfume_requests) — бодит
 * Postgres.
 *
 *   pnpm db:test-perfume-requests-dev      # зөвхөн .env.dev
 *
 * Сан бохирдуулахгүй: сценари бүр `begin … rollback` дотор явна (тугийн
 * утгыг ч транзакц дотор сольж, буцаана).
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✖ ${name}`, detail ?? "");
  }
}

async function scenario(
  c: Client,
  name: string,
  body: () => Promise<void>,
): Promise<void> {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    await setFlag(c, true);
    await body();
  } catch (e) {
    failed++;
    console.log("  ✖ алдаа", e);
  } finally {
    await c.query("rollback");
  }
}

async function setFlag(c: Client, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ('perfume_requests', $1)
       on conflict (key) do update set enabled = excluded.enabled`,
    [on],
  );
}

interface Submit {
  requestId: string;
  isNew: boolean;
  isNewVote: boolean;
  voteCount: number;
}

async function submit(
  c: Client,
  user: string,
  brand: string,
  name: string,
  opts: { note?: string; concentration?: string } = {},
): Promise<Submit | null> {
  const { rows } = await c.query<{ r: Submit | null }>(
    "select submit_perfume_request($1, $2, $3, $4, $5) as r",
    [user, brand, name, opts.concentration ?? null, opts.note ?? null],
  );
  return rows[0].r;
}

/** Алдаа хүлээгдэж буй дуудлага — savepoint-оор транзакцыг амьд үлдээнэ. */
async function errorOf(
  c: Client,
  sql: string,
  params: unknown[],
): Promise<string | null> {
  await c.query("savepoint expect_error");
  try {
    await c.query(sql, params);
    await c.query("release savepoint expect_error");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint expect_error");
    return (e as Error).message;
  }
}

async function countOf(c: Client, requestId: string) {
  const { rows } = await c.query<{ vote_count: number; real: number }>(
    `select r.vote_count,
            (select count(*)::int from perfume_request_votes v
              where v.request_id = r.id) as real
       from perfume_requests r where r.id = $1`,
    [requestId],
  );
  return rows[0] ?? null;
}

async function main() {
  const c = await connectDb(url!);
  const users = await c.query<{ id: string }>(
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 3`,
  );
  if (users.rows.length < 3) throw new Error("Dev санд 3 хэрэглэгч хэрэгтэй.");
  const [u1, u2, u3] = users.rows.map((r) => r.id);

  await scenario(c, "Туг хаалттай: юу ч үүсэхгүй", async () => {
    await setFlag(c, false);
    const r = await submit(c, u1, "Тест Брэнд", "Хаалттай");
    check("submit → null", r === null, r);
    const { rows } = await c.query(
      "select 1 from perfume_requests where brand_name = 'Тест Брэнд'",
    );
    check("мөр үүсээгүй", rows.length === 0);
  });

  await scenario(c, "Шинэ санал ба «+1»", async () => {
    const a = await submit(c, u1, "Zz Test House", "Velvet Oud", {
      note: "Дубайд үнэрлэсэн",
    });
    check("анхны санал шинэ", a?.isNew === true && a.isNewVote, a);
    check("тоо 1", a?.voteCount === 1, a);

    const b = await submit(c, u2, "  zz test  house ", "VELVET-OUD");
    check("өөр бичлэг → ижил мөр", b?.requestId === a?.requestId, b);
    check("шинэ мөр биш, шинэ санал", b?.isNew === false && b.isNewVote, b);
    check("тоо 2", b?.voteCount === 2, b);

    const again = await submit(c, u1, "Zz Test House", "Velvet Oud");
    check("ижил хүн дахин → тоо нэмэгдэхгүй", again?.voteCount === 2, again);
    check("isNewVote = false", again?.isNewVote === false, again);
    const { rows } = await c.query<{ note: string }>(
      "select note from perfume_request_votes where request_id = $1 and user_id = $2",
      [a!.requestId, u1],
    );
    check(
      "тайлбаргүй дахин илгээхэд хуучин тайлбар хэвээр",
      rows[0]?.note === "Дубайд үнэрлэсэн",
      rows[0],
    );
    await submit(c, u1, "Zz Test House", "Velvet Oud", { note: "Шинэ" });
    const { rows: r2 } = await c.query<{ note: string }>(
      "select note from perfume_request_votes where request_id = $1 and user_id = $2",
      [a!.requestId, u1],
    );
    check("шинэ тайлбар шинэчлэгдэнэ", r2[0]?.note === "Шинэ", r2[0]);
    const counted = await countOf(c, a!.requestId);
    check(
      "vote_count = бодит тоо",
      counted?.vote_count === counted?.real,
      counted,
    );
  });

  await scenario(c, "Кирилл ↔ латин ижил түлхүүр", async () => {
    const a = await submit(c, u1, "Zz Тест", "Ноир");
    const b = await submit(c, u2, "Zz Test", "Noir");
    check("ижил мөр", Boolean(a) && a?.requestId === b?.requestId, { a, b });
  });

  await scenario(c, "Буруу оролт", async () => {
    const err = await errorOf(
      c,
      "select submit_perfume_request($1, '  ', 'X')",
      [u1],
    );
    check(
      "хоосон брэнд → INVALID_INPUT",
      err?.includes("INVALID_INPUT") ?? false,
      err,
    );
    const err2 = await errorOf(
      c,
      "select submit_perfume_request($1, '!!', '--')",
      [u1],
    );
    check(
      "зөвхөн тэмдэгт → INVALID_INPUT",
      err2?.includes("INVALID_INPUT") ?? false,
      err2,
    );
  });

  await scenario(c, "Хэрэглэгч устахад санал хасагдана", async () => {
    const a = await submit(c, u1, "Zz Cascade", "One");
    await submit(c, u2, "Zz Cascade", "One");
    await c.query(
      "delete from perfume_request_votes where request_id = $1 and user_id = $2",
      [a!.requestId, u2],
    );
    const counted = await countOf(c, a!.requestId);
    check(
      "тоо 1 болж буурна",
      counted?.vote_count === 1 && counted.real === 1,
      counted,
    );
  });

  await scenario(c, "Нэгтгэх", async () => {
    const src = await submit(c, u1, "Zz Merge", "Sauvag");
    await submit(c, u2, "Zz Merge", "Sauvag");
    const dst = await submit(c, u2, "Zz Merge", "Sauvage");
    await submit(c, u3, "Zz Merge", "Sauvage");
    const { rows } = await c.query<{ n: number }>(
      "select merge_perfume_requests($1, $2) as n",
      [src!.requestId, dst!.requestId],
    );
    check("нийт 3 (u2 давхар тоологдоогүй)", rows[0].n === 3, rows[0]);
    const counted = await countOf(c, dst!.requestId);
    check(
      "vote_count = бодит тоо",
      counted?.vote_count === 3 && counted.real === 3,
      counted,
    );
    check("эх мөр устсан", (await countOf(c, src!.requestId)) === null);

    const err = await errorOf(c, "select merge_perfume_requests($1, $1)", [
      dst!.requestId,
    ]);
    check(
      "өөр рүүгээ → INVALID_MERGE",
      err?.includes("INVALID_MERGE") ?? false,
      err,
    );
  });

  await scenario(c, "Эрх: anon/authenticated дуудаж чадахгүй", async () => {
    const fns = [
      "submit_perfume_request(uuid, text, text, text, text, uuid)",
      "merge_perfume_requests(uuid, uuid)",
    ];
    for (const fn of fns) {
      const { rows } = await c.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as auth`,
        [fn],
      );
      check(
        `${fn.split("(")[0]}: эрхгүй`,
        !rows[0].anon && !rows[0].auth,
        rows[0],
      );
    }
  });

  await c.end();
  console.log(failed === 0 ? "\n✅ Бүгд амжилттай." : `\n✖ ${failed} алдаа.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
