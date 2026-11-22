/**
 * `place_order`-ийн V point-ийн integration тест (0144, extras-shop-plan §0) —
 * бодит Postgres дээр.
 *
 *   pnpm db:test-orders-dev      # зөвхөн .env.dev
 *
 * Vitest-д ороогүй: row lock-ийг хоёр тусдаа холболтгүйгээр шалгаж чадахгүй.
 *
 * Сан бохирдуулахгүй: дараалсан сценари `begin … rollback` дотор явна.
 * Зэрэг илгээлтийн тест л commit хийх ёстой (хоёр дахь холболт эхнийхийн
 * хасалтыг харах ёстой) — тэр захиалгыг `finally` дотор цуцалж устгаад,
 * хэрэглэгчийн оноог анхны утгад нь буцаана.
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

interface Fixture {
  user: string;
  rate: number;
  line: { product_id: string; variant_id: string; ml: number; price: number };
}

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✖ ${name}`, detail ?? "");
  }
}

async function loadFixture(c: Client): Promise<Fixture> {
  const users = await c.query<{ id: string }>(
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 1`,
  );
  const lines = await c.query<Fixture["line"]>(`
    select i.product_id, pv.id as variant_id, pv.ml, variant_price(pv.*) as price
      from inventory i
      join products p on p.id = i.product_id
      join product_variants pv on pv.product_id = p.id
     where i.on_hand_ml - i.reserved_ml >= 100
       and p.is_active and p.status = 'active'
       and pv.is_active
       and variant_price(pv.*) >= 5000
       and (p.gender is null or bottle_active(p.gender, pv.ml))
     order by pv.ml
     limit 1`);
  const rate = await c.query<{ rate: number }>(
    `select coalesce((value->>'redeemRate')::numeric, 1)::float8 as rate
       from settings where key = 'loyalty'`,
  );
  if (users.rows.length < 1 || lines.rows.length < 1) {
    throw new Error("Dev санд хэрэглэгч ба үлдэгдэлтэй бараа хэрэгтэй.");
  }
  return {
    user: users.rows[0].id,
    rate: rate.rows[0]?.rate ?? 1,
    line: lines.rows[0],
  };
}

/** `p_points` оноо ₮-өөр хэд болох — place_order-той ижил томьёо. */
function pointsValue(f: Fixture, points: number) {
  return Math.floor(points * f.rate);
}

async function placeOrder(c: Client, f: Fixture, loyalty: number) {
  const { rows } = await c.query<{ r: { order_id: string } }>(
    "select place_order($1::jsonb, $2::jsonb) as r",
    [
      JSON.stringify({
        user_id: f.user,
        contact_name: "Loyalty test",
        contact_phone: "99000000",
        ship_detail: "test",
        shipping_fee: 0,
        loyalty_used: loyalty,
      }),
      JSON.stringify([
        {
          product_id: f.line.product_id,
          variant_id: f.line.variant_id,
          ml: f.line.ml,
          qty: 1,
        },
      ]),
    ],
  );
  const id = rows[0].r.order_id;
  const o = await c.query<{ loyalty_used: number; total: number }>(
    "select loyalty_used, total from orders where id = $1",
    [id],
  );
  return { id, ...o.rows[0] };
}

/**
 * Алдааны мессежийг буцаана (амжилттай бол null). Savepoint дотор — алдаа
 * гадна талын transaction-ийг тасалдуулахгүй, дараагийн шалгалт үргэлжилнэ.
 */
async function placeOrderError(c: Client, f: Fixture, loyalty: number) {
  await c.query("savepoint place_try");
  try {
    await placeOrder(c, f, loyalty);
    await c.query("release savepoint place_try");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint place_try");
    return (e as Error).message;
  }
}

async function scenario(c: Client, name: string, fn: () => Promise<void>) {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    await fn();
  } catch (e) {
    failed++;
    console.log("  ✖ алдаа:", (e as Error).message);
  } finally {
    await c.query("rollback");
  }
}

async function main() {
  const a = await connectDb(url!);
  const b = await connectDb(url!);
  const f = await loadFixture(a);
  // ₮-өөр бараанаас бага, тэгээд оноогоор бүтэн төлөгдөх дүн.
  const points = Math.max(Math.floor(1000 / f.rate), 1);
  const value = pointsValue(f, points);

  await scenario(a, "Дараалсан хоёр захиалга сүүлийн оноогоор", async () => {
    await a.query("update profiles set loyalty_points = $2 where id = $1", [
      f.user,
      points,
    ]);
    const first = await placeOrder(a, f, value);
    check("эхнийх нь оноо ашигласан", first.loyalty_used === value, first);
    const err = await placeOrderError(a, f, value);
    check(
      "хоёр дахь нь LOYALTY_CHANGED:0",
      err?.includes("LOYALTY_CHANGED:0") ?? false,
      err,
    );
    const p = await a.query<{ loyalty_points: number }>(
      "select loyalty_points from profiles where id = $1",
      [f.user],
    );
    check("оноо сөрөг болоогүй", p.rows[0].loyalty_points === 0, p.rows[0]);
  });

  await scenario(a, "Боломжтойгоос их оноо — чимээгүй хумихгүй", async () => {
    await a.query("update profiles set loyalty_points = $2 where id = $1", [
      f.user,
      points,
    ]);
    const before = await a.query<{ n: number }>(
      "select count(*)::int as n from orders where user_id = $1",
      [f.user],
    );
    const err = await placeOrderError(a, f, value + 1);
    check(
      `LOYALTY_CHANGED:${value}`,
      err?.includes(`LOYALTY_CHANGED:${value}`) ?? false,
      err,
    );
    const after = await a.query<{ n: number }>(
      "select count(*)::int as n from orders where user_id = $1",
      [f.user],
    );
    check("захиалга үүсээгүй", after.rows[0].n === before.rows[0].n);
  });

  await scenario(a, "Боломжтой оноогоор яг тэнцүү — амжилттай", async () => {
    await a.query("update profiles set loyalty_points = $2 where id = $1", [
      f.user,
      points,
    ]);
    const o = await placeOrder(a, f, value);
    check("бүтэн ашигласан", o.loyalty_used === value, o);
  });

  // ── Зэрэг илгээлт: хоёр холболт ──────────────────────────────────────
  console.log("\nЗэрэг илгээлт (profiles row lock)");
  const original = await a.query<{ loyalty_points: number }>(
    "select loyalty_points from profiles where id = $1",
    [f.user],
  );
  let placedA: string | null = null;
  try {
    await a.query("update profiles set loyalty_points = $2 where id = $1", [
      f.user,
      points,
    ]);
    await a.query("begin");
    const first = await placeOrder(a, f, value);
    placedA = first.id;
    check("A оноо ашигласан (түгжээ барьж байна)", first.loyalty_used === value);

    await b.query("begin");
    // B нь A-гийн profiles түгжээн дээр хүлээнэ. A commit хийсний дараа
    // шинэчлэгдсэн (0) үлдэгдлийг уншиж татгалзах ёстой — хуучин код энд
    // түгжээгүй уншаад 2 дахь хөнгөлөлтийг өгдөг байв.
    const pendingB = placeOrderError(b, f, value);
    await new Promise((r) => setTimeout(r, 500));
    await a.query("commit");
    const errB = await pendingB;
    await b.query("rollback");
    check(
      "B → LOYALTY_CHANGED:0",
      errB?.includes("LOYALTY_CHANGED:0") ?? false,
      errB,
    );
  } finally {
    await a.query("rollback").catch(() => {});
    if (placedA) {
      // Цуцлалт нөөц, оноог буцаана; дараа нь мөрүүдийг устгана.
      await a.query("select update_order_status($1, 'cancelled', 'test', null)", [
        placedA,
      ]);
      await a.query("delete from loyalty_ledger where order_id = $1", [placedA]);
      await a.query("delete from orders where id = $1", [placedA]);
    }
    await a.query("update profiles set loyalty_points = $2 where id = $1", [
      f.user,
      original.rows[0].loyalty_points,
    ]);
    await a.end();
    await b.end();
  }

  console.log(failed === 0 ? "\n✅ Бүгд амжилттай." : `\n✖ ${failed} алдаа.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
