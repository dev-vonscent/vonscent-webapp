/**
 * Нэртэй хямдралын (0188_named_sales) integration тест — бодит Postgres.
 *
 *   pnpm db:test-named-sales-dev      # зөвхөн .env.dev
 *
 * Сан бохирдуулахгүй: сценари бүр `begin … rollback` дотор (тугийн утгыг ч
 * транзакц дотор сольж буцаана). Dev санд байгаа хямдралд нөлөөлөхгүйн тулд
 * сценари эхлэхэд бүх хэмжээний хямдралыг транзакц дотор цэвэрлэнэ.
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

async function setFlag(c: Client, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ('named_sales', $1)
       on conflict (key) do update set enabled = excluded.enabled`,
    [on],
  );
}

async function scenario(c: Client, name: string, body: () => Promise<void>) {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    await c.query(
      `update product_variants
          set sale_price = null, sale_starts_at = null, sale_ends_at = null,
              sale_id = null
        where sale_price is not null or sale_id is not null`,
    );
    await setFlag(c, true);
    await body();
  } catch (e) {
    failed++;
    console.log("  ✖ алдаа", e);
  } finally {
    await c.query("rollback");
  }
}

async function errorOf(c: Client, sql: string, params: unknown[] = []) {
  await c.query("savepoint t");
  try {
    await c.query(sql, params);
    await c.query("release savepoint t");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint t");
    return e as Error & { detail?: string };
  }
}

const SAVE = `select save_sale($1, $2, $3::jsonb, $4, $5, $6::uuid[], $7) as id`;
const IN_DAY = "now() + interval '1 day'";

/** Идэвхтэй, 5ml ба 10ml нь үнэтэй хоёр бараа. */
async function products(c: Client): Promise<[string, string]> {
  const r = await c.query<{ product_id: string }>(
    `select v.product_id from product_variants v
       join products p on p.id = v.product_id
      where v.is_active and v.price > 0 and v.ml in (5, 10)
      group by v.product_id having count(*) = 2
      order by v.product_id limit 2`,
  );
  if (r.rows.length < 2) throw new Error("fixture: 2 бараа олдсонгүй");
  return [r.rows[0].product_id, r.rows[1].product_id];
}

async function variant(c: Client, product: string, ml: number) {
  const r = await c.query<{
    price: number;
    sale_price: number | null;
    sale_id: string | null;
    sale_ends_at: Date | null;
    variant_price: number;
  }>(
    `select v.price, v.sale_price, v.sale_id, v.sale_ends_at,
            variant_price(v) as variant_price
       from product_variants v where product_id = $1 and ml = $2`,
    [product, ml],
  );
  return r.rows[0];
}

async function main() {
  const c = await connectDb(url!);
  const ends = (await c.query<{ t: Date }>(`select ${IN_DAY} as t`)).rows[0].t;

  await scenario(c, "Туг хаалттай → FEATURE_DISABLED", async () => {
    await setFlag(c, false);
    const [a] = await products(c);
    const e = await errorOf(c, SAVE, [
      null, "Тест", { "5": 10 }, null, ends, [a], false,
    ]);
    check("FEATURE_DISABLED", e?.message === "FEATURE_DISABLED", e?.message);
  });

  await scenario(c, "Үүсгэх: хувиас үнэ, sale_id, хугацаа", async () => {
    const [a, b] = await products(c);
    const r = await c.query<{ id: string }>(SAVE, [
      null, "Март 8", { "5": 10 }, null, ends, [a, b], false,
    ]);
    const id = r.rows[0].id;
    const v = await variant(c, a, 5);
    const expected = Math.min(v.price, Math.round((v.price * 0.9) / 100) * 100);
    check("5ml хямдарсан", v.sale_price === expected, v);
    check("variant_price = sale_price", v.variant_price === expected, v);
    check("sale_id тавигдсан", v.sale_id === id, v);
    const v10 = await variant(c, a, 10);
    check("10ml хөндөгдөөгүй", v10.sale_price === null && v10.sale_id === null);
  });

  await scenario(c, "16.2: нэр заавал, хувь/хугацаа шалгалт", async () => {
    const [a] = await products(c);
    const name = await errorOf(c, SAVE, [null, "  ", { "5": 10 }, null, ends, [a], false]);
    check("BAD_NAME", name?.message === "BAD_NAME", name?.message);
    const pct = await errorOf(c, SAVE, [null, "x", { "5": 95 }, null, ends, [a], false]);
    check("BAD_PCT (95%)", pct?.message === "BAD_PCT", pct?.message);
    const size = await errorOf(c, SAVE, [null, "x", { "7": 10 }, null, ends, [a], false]);
    check("BAD_PCT (7ml)", size?.message === "BAD_PCT", size?.message);
    const none = await errorOf(c, SAVE, [null, "x", {}, null, ends, [a], false]);
    check("BAD_PCT (хоосон)", none?.message === "BAD_PCT", none?.message);
  });

  await scenario(c, "16.3: өөр дуусаагүй хямдралд байгаа бараа", async () => {
    const [a, b] = await products(c);
    await c.query(SAVE, [null, "Март 8", { "5": 10 }, null, ends, [a], false]);
    const e = await errorOf(c, SAVE, [
      null, "Шинэ", { "5": 20 }, null, ends, [a, b], false,
    ]);
    check("SALE_CONFLICT", e?.message === "SALE_CONFLICT", e?.message);
    check("detail-д хямдралын нэр", (e?.detail ?? "").includes("Март 8"), e?.detail);
  });

  await scenario(c, "16.3: дууссан хямдрал саад болохгүй", async () => {
    const [a] = await products(c);
    const r = await c.query<{ id: string }>(SAVE, [
      null, "Хуучин", { "5": 10 }, null, ends, [a], false,
    ]);
    await c.query(`select end_sale($1)`, [r.rows[0].id]);
    // Транзакц дотор now() тогтмол — дууссаныг ends_at-аар ухрааж үүсгэнэ.
    await c.query(
      `update product_variants set sale_ends_at = now() - interval '1 second'
        where sale_id = $1`,
      [r.rows[0].id],
    );
    const e = await errorOf(c, SAVE, [
      null, "Шинэ", { "5": 20 }, null, ends, [a], false,
    ]);
    check("дууссан хямдралын бараа шинэд орно", e === null, e?.message);
  });

  await scenario(c, "16.5: бүх хэмжээ хямдралгүй бараа", async () => {
    const [a] = await products(c);
    // 2ml-гүй / 2ml нь үнэгүй бараа байж болох тул байхгүй хэмжээ сонгоно:
    await c.query(
      `update product_variants set is_active = false where product_id = $1 and ml = 20`,
      [a],
    );
    const e = await errorOf(c, SAVE, [
      null, "x", { "20": 10 }, null, ends, [a], false,
    ]);
    check(
      "PRODUCT_WITHOUT_DISCOUNT",
      e?.message === "PRODUCT_WITHOUT_DISCOUNT" && (e?.detail ?? "").includes(a),
      e?.message,
    );
  });

  await scenario(c, "16.4: засах — бараа хасах, хувь солих, хэмжээ хасах", async () => {
    const [a, b] = await products(c);
    const r = await c.query<{ id: string }>(SAVE, [
      null, "Март 8", { "5": 10, "10": 10 }, null, ends, [a, b], false,
    ]);
    const id = r.rows[0].id;
    await c.query(SAVE, [id, "Март 8 (сунгасан)", { "5": 30 }, null, ends, [a], false]);
    const va5 = await variant(c, a, 5);
    const exp = Math.min(va5.price, Math.round((va5.price * 0.7) / 100) * 100);
    check("хувь 30% болсон", va5.sale_price === exp, va5);
    const va10 = await variant(c, a, 10);
    check("10ml хасагдсан → энгийн үнэ", va10.sale_price === null && va10.sale_id === null, va10);
    const vb = await variant(c, b, 5);
    check("хасагдсан бараа → энгийн үнэ", vb.sale_price === null && vb.sale_id === null, vb);
    const s = await c.query(`select name from sales where id = $1`, [id]);
    check("нэр шинэчлэгдсэн", s.rows[0]?.name === "Март 8 (сунгасан)");
  });

  await scenario(c, "16.4: дуусгах / эхлээгүйг дуусгахгүй / устгах", async () => {
    const [a, b] = await products(c);
    const r = await c.query<{ id: string }>(SAVE, [
      null, "Явж буй", { "5": 10 }, null, ends, [a], false,
    ]);
    await c.query(`select end_sale($1)`, [r.rows[0].id]);
    const v = await variant(c, a, 5);
    // Транзакц дотор now() тогтмол тул ends_at = now() → дууссан.
    check("дуусгасны дараа энгийн үнэ", v.variant_price === v.price, v);

    const s2 = await c.query<{ id: string }>(SAVE, [
      null, "Товлосон", { "5": 10 }, ends, new Date(ends.getTime() + 86_400_000), [b], false,
    ]);
    const e = await errorOf(c, `select end_sale($1)`, [s2.rows[0].id]);
    check("эхлээгүйг дуусгахгүй (NOT_STARTED)", e?.message === "NOT_STARTED", e?.message);
    await c.query(`select delete_sale($1)`, [s2.rows[0].id]);
    const vb = await variant(c, b, 5);
    check("устгасны дараа үнэ цэвэрлэгдсэн", vb.sale_price === null && vb.sale_id === null, vb);
  });

  await scenario(c, "16.6: «Нэргүй»-г нэрлэх (adopt)", async () => {
    const [a, b] = await products(c);
    // Хуучин нэргүй хямдрал: a 5ml, b 5ml.
    await c.query(
      `update product_variants
          set sale_price = price - 1000, sale_ends_at = ${IN_DAY}
        where product_id = any($1::uuid[]) and ml = 5`,
      [[a, b]],
    );
    const blocked = await errorOf(c, SAVE, [
      null, "x", { "5": 10 }, null, ends, [a], false,
    ]);
    check("нэргүй хямдрал ч саад болно", blocked?.message === "SALE_CONFLICT", blocked?.message);
    const r = await c.query<{ id: string }>(SAVE, [
      null, "Намрын", { "5": 10 }, null, ends, [a], true,
    ]);
    const va = await variant(c, a, 5);
    check("a шинэ хямдралд шилжсэн", va.sale_id === r.rows[0].id, va);
    const vb = await variant(c, b, 5);
    check("жагсаалтаас хассан b → энгийн үнэ", vb.sale_price === null, vb);
    const left = await c.query(
      `select count(*)::int as n from product_variants
        where sale_id is null and sale_price is not null`,
    );
    check("нэргүй мөр үлдээгүй", left.rows[0].n === 0, left.rows[0]);
  });

  await c.end();
  console.log(failed ? `\n✖ ${failed} шалгалт унасан` : "\n✓ Бүгд тэнцсэн");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
