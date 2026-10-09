/**
 * Купоны RPC-ийн integration тест (0104_coupon_rework) — бодит Postgres дээр.
 *
 *   pnpm db:test-coupons-dev      # зөвхөн .env.dev
 *
 * Vitest-д ороогүй: `place_order` ба RLS-ийг mock-оор шалгах боломжгүй, харин
 * row lock-ийг хоёр тусдаа холболтгүйгээр шалгаж чадахгүй.
 *
 * Сан бохирдуулахгүй: сценари бүр `begin … rollback` дотор явна. Цорын ганц
 * commit хийгдэх зүйл нь зэрэг ашиглалтын тестийн купон (хоёр дахь холболт
 * түүнийг харах ёстой) бөгөөд `finally` дотор устгагдана.
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

interface Fixture {
  owner: string;
  friend: string;
  lines: { product_id: string; variant_id: string; ml: number }[];
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
    // Staff бүх купоныг хардаг тул RLS-ийг энгийн хэрэглэгчээр шалгана.
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 2`,
  );
  // Хоёр ӨӨР бараа: нэг бараа бол inventory-ийн түгжээ купоны түгжээнээс
  // түрүүлж барина — тэгвэл купоны lock-ийг шалгасан болохгүй.
  const lines = await c.query<{
    product_id: string;
    variant_id: string;
    ml: number;
  }>(`
    select distinct on (i.product_id) i.product_id, pv.id as variant_id, pv.ml
      from inventory i
      join products p on p.id = i.product_id
      join product_variants pv on pv.product_id = p.id
     where i.on_hand_ml - i.reserved_ml >= 100
       and variant_price(pv.*) > 0
       and (p.gender is null or bottle_active(p.gender, pv.ml))
     order by i.product_id, pv.ml
     limit 2`);
  if (users.rows.length < 2 || lines.rows.length < 2) {
    throw new Error("Dev санд 2 хэрэглэгч ба үлдэгдэлтэй 2 бараа хэрэгтэй.");
  }
  return {
    owner: users.rows[0].id,
    friend: users.rows[1].id,
    lines: lines.rows,
  };
}

function orderArgs(
  f: Fixture,
  user: string | null,
  code: string,
  line = 0,
  loyalty = 0,
) {
  const l = f.lines[line];
  return [
    JSON.stringify({
      user_id: user,
      contact_name: "Coupon test",
      contact_phone: "99000000",
      ship_detail: "test",
      shipping_fee: 0,
      coupon_code: code,
      loyalty_used: loyalty,
    }),
    JSON.stringify([
      { product_id: l.product_id, variant_id: l.variant_id, ml: l.ml, qty: 1 },
    ]),
  ];
}

async function placeOrder(
  c: Client,
  f: Fixture,
  user: string | null,
  code: string,
  line = 0,
  loyalty = 0,
) {
  const { rows } = await c.query<{ r: { order_id: string } }>(
    "select place_order($1::jsonb, $2::jsonb) as r",
    orderArgs(f, user, code, line, loyalty),
  );
  const id = rows[0].r.order_id;
  const o = await c.query<{ discount: number; loyalty_used: number }>(
    "select discount, loyalty_used from orders where id = $1",
    [id],
  );
  return { id, ...o.rows[0] };
}

async function insertCoupon(
  c: Client,
  code: string,
  owner: string | null,
  maxUses: number | null = owner ? 1 : null,
) {
  await c.query(
    `insert into coupons (code, user_id, type, value, min_subtotal, max_uses, is_active)
     values ($1, $2, 'fixed', 1000, 0, $3, true)`,
    [code, owner, maxUses],
  );
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
  const tag = `T${Date.now().toString(36).toUpperCase()}`;

  await scenario(a, "Зочин купон, оноо ашиглаж чадахгүй", async () => {
    await insertCoupon(a, `${tag}-PUB`, null);
    const v = await a.query("select validate_coupon($1, 50000, null) as r", [
      `${tag}-PUB`,
    ]);
    check(
      "validate_coupon → LOGIN_REQUIRED",
      v.rows[0].r.reason === "LOGIN_REQUIRED",
      v.rows[0].r,
    );
    const o = await placeOrder(a, f, null, `${tag}-PUB`, 0, 5000);
    check("place_order хөнгөлөлтгүй", o.discount === 0, o);
    check("place_order оноогүй", o.loyalty_used === 0, o);
    const used = await a.query(
      "select used_count from coupons where code = $1",
      [`${tag}-PUB`],
    );
    check("used_count өөрчлөгдөөгүй", used.rows[0].used_count === 0);
  });

  await scenario(a, "Нийтийн купон жагсаалтад харагдахгүй (RLS)", async () => {
    await insertCoupon(a, `${tag}-PUB`, null);
    await insertCoupon(a, `${tag}-MINE`, f.owner);
    await insertCoupon(a, `${tag}-OTHER`, f.friend);
    await a.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: f.owner, role: "authenticated" }),
    ]);
    await a.query("set local role authenticated");
    const { rows } = await a.query<{ code: string }>(
      "select code from coupons where code like $1 order by code",
      [`${tag}-%`],
    );
    check(
      "зөвхөн өөрийнх нь харагдана",
      rows.length === 1 && rows[0].code === `${tag}-MINE`,
      rows,
    );
    let denied = false;
    try {
      await a.query("select validate_coupon('X', 1, null)");
    } catch {
      denied = true;
    }
    check("authenticated validate_coupon-ийг шууд дуудаж чадахгүй", denied);
  });

  await scenario(a, "Хуваалцсан купоныг найз ашиглана", async () => {
    await insertCoupon(a, `${tag}-SHARE`, f.owner);
    const o = await placeOrder(a, f, f.friend, `${tag}-SHARE`);
    check("найз хөнгөлөлт авсан", o.discount === 1000, o);
    const cp = await a.query(
      "select id, used_count, max_uses from coupons where code = $1",
      [`${tag}-SHARE`],
    );
    check(
      "эзэмшигчийн купон хэрэглэгдсэн",
      cp.rows[0].used_count === cp.rows[0].max_uses,
    );
    const log = await a.query(
      "select user_id, order_id, created_at from coupon_redemptions where coupon_id = $1",
      [cp.rows[0].id],
    );
    check(
      "log-д найзын user_id, order_id бий",
      log.rows.length === 1 &&
        log.rows[0].user_id === f.friend &&
        log.rows[0].order_id === o.id,
      log.rows,
    );
    const again = await a.query("select validate_coupon($1, 50000, $2) as r", [
      `${tag}-SHARE`,
      f.owner,
    ]);
    check(
      "эзэмшигч дахин ашиглаж чадахгүй",
      again.rows[0].r.reason === "MAX_USES",
      again.rows[0].r,
    );
  });

  await scenario(a, "Цуцлалтын дараа купон эзэмшигчид буцна", async () => {
    await insertCoupon(a, `${tag}-BACK`, f.owner);
    const o = await placeOrder(a, f, f.friend, `${tag}-BACK`);
    await a.query("update orders set status = 'cancelled' where id = $1", [
      o.id,
    ]);
    const cp = await a.query(
      "select id, used_count from coupons where code = $1",
      [`${tag}-BACK`],
    );
    check("used_count буцаж 0", cp.rows[0].used_count === 0, cp.rows[0]);
    const log = await a.query(
      "select cancelled_at from coupon_redemptions where coupon_id = $1",
      [cp.rows[0].id],
    );
    check(
      "log үлдэж, cancelled_at тавигдсан",
      log.rows.length === 1 && log.rows[0].cancelled_at != null,
      log.rows,
    );
    const v = await a.query("select validate_coupon($1, 50000, $2) as r", [
      `${tag}-BACK`,
      f.owner,
    ]);
    check(
      "эзэмшигч дахин ашиглаж болно",
      v.rows[0].r.valid === true,
      v.rows[0].r,
    );
  });

  await scenario(
    a,
    "Дараалсан хоёр захиалга — хоёр дахь нь хөнгөлөлтгүй",
    async () => {
      await insertCoupon(a, `${tag}-SEQ`, f.owner);
      const first = await placeOrder(a, f, f.friend, `${tag}-SEQ`, 0);
      const second = await placeOrder(a, f, f.owner, `${tag}-SEQ`, 1);
      check("эхнийх нь авсан", first.discount === 1000, first);
      check("хоёр дахь нь авсангүй", second.discount === 0, second);
    },
  );

  // ── Автомат урамшууллын шатлал (0118) ────────────────────────────────
  // Захиалгын subtotal-ыг шууд тавьж, `grant_reward_coupon`-ыг дуудна —
  // каталогийн үнээс хамааралгүй яг босгон дээр шалгахын тулд.
  async function rewardFor(settings: unknown, subtotal: number, discount = 0) {
    await a.query(
      `insert into settings (key, value) values ('coupons', $1::jsonb)
         on conflict (key) do update set value = excluded.value`,
      [JSON.stringify(settings)],
    );
    const o = await placeOrder(a, f, f.owner, "");
    await a.query(
      "update orders set subtotal = $2, discount = $3 where id = $1",
      [o.id, subtotal, discount],
    );
    const g = await a.query<{ code: string | null }>(
      "select grant_reward_coupon($1) as code",
      [o.id],
    );
    const cp = await a.query<{
      type: string;
      value: number;
      max_uses: number;
      days: number;
    }>(
      `select type, value, max_uses,
              round(extract(epoch from ends_at - now()) / 86400)::int as days
         from coupons where source_order_id = $1`,
      [o.id],
    );
    return { id: o.id, code: g.rows[0].code, coupons: cp.rows };
  }
  const t = (minTotal: number, value: number, extra: object = {}) => ({
    id: `t${minTotal}-${value}`,
    enabled: true,
    minTotal,
    type: "percent",
    value,
    validDays: 30,
    maxUsesPerUser: 1,
    ...extra,
  });
  const ladder = { tiers: [t(100_000, 5), t(300_000, 15)] };

  await scenario(a, "Шатлал: 300k+ зөвхөн 300k-ийн купон", async () => {
    const r = await rewardFor(ladder, 350_000);
    check(
      "ганц купон, 15%",
      r.coupons.length === 1 && r.coupons[0].value === 15,
      r.coupons,
    );
  });

  await scenario(a, "Шатлал: яг 300,000 → 300k-ийнх", async () => {
    const r = await rewardFor(ladder, 300_000);
    check("15%", r.coupons[0]?.value === 15, r.coupons);
  });

  await scenario(a, "Шатлал: 299,999 → 100k-ийнх", async () => {
    const r = await rewardFor(ladder, 299_999);
    check("5%", r.coupons.length === 1 && r.coupons[0].value === 5, r.coupons);
  });

  await scenario(a, "Шатлал: купоны хямдрал суурийг бууруулна", async () => {
    const r = await rewardFor(ladder, 310_000, 20_000);
    check("290k суурь → 5%", r.coupons[0]?.value === 5, r.coupons);
  });

  await scenario(a, "Шатлал: аль ч босгод хүрээгүй → купонгүй", async () => {
    const r = await rewardFor(ladder, 99_999);
    check("купонгүй", r.code === null && r.coupons.length === 0, r);
  });

  await scenario(a, "Шатлал: дээд нь унтраалттай → доод нь", async () => {
    const r = await rewardFor(
      { tiers: [t(100_000, 5), t(300_000, 15, { enabled: false })] },
      500_000,
    );
    check("5%", r.coupons[0]?.value === 5, r.coupons);
  });

  await scenario(a, "Шатлал: тогтсон дүн, хугацаа, хязгаар", async () => {
    const r = await rewardFor(
      {
        tiers: [
          t(200_000, 20_000, {
            type: "fixed",
            validDays: 14,
            maxUsesPerUser: 2,
          }),
        ],
      },
      250_000,
    );
    const c = r.coupons[0];
    check(
      "fixed 20,000₮, 14 хоног, 2 удаа",
      c?.type === "fixed" &&
        c.value === 20_000 &&
        c.days === 14 &&
        c.max_uses === 2,
      c,
    );
  });

  await scenario(a, "Шатлал: давхар баталгаажуулалт → нэг купон", async () => {
    const r = await rewardFor(ladder, 350_000);
    const again = await a.query("select grant_reward_coupon($1) as code", [
      r.id,
    ]);
    const n = await a.query(
      "select count(*)::int as n from coupons where source_order_id = $1",
      [r.id],
    );
    check(
      "хоёр дахь дуудалт null, купон 1",
      again.rows[0].code === null && n.rows[0].n === 1,
    );
  });

  await scenario(a, "Шатлал: хуучин autoGrant хэлбэр ажилласаар", async () => {
    const legacy = {
      autoGrant: { enabled: true, type: "percent", value: 10, validDays: 30 },
    };
    const below = await rewardFor(legacy, 299_999);
    check(
      "minTotal-гүй → 300k анхдагч (доор нь купонгүй)",
      below.code === null,
    );
    const r = await rewardFor(legacy, 300_000);
    check("300k → 10%", r.coupons[0]?.value === 10, r.coupons);
  });

  await scenario(a, "Шатлал: эвдэрсэн мөр төлбөрийг унагахгүй", async () => {
    const r = await rewardFor(
      {
        tiers: [
          "junk",
          { enabled: true, minTotal: "abc", value: 10 },
          t(100_000, 1e12),
          t(100_000, 7.5, { validDays: 99_999, maxUsesPerUser: 1e9 }),
        ],
      },
      150_000,
    );
    const c = r.coupons[0];
    check(
      "зөв хэлбэртэй нь л үйлчилж, утгууд хавчигдсан",
      c?.value === 7 && c.days === 365 && c.max_uses === 100,
      r.coupons,
    );
  });

  await scenario(a, "Шатлал: зочинд купонгүй", async () => {
    await a.query(
      `insert into settings (key, value) values ('coupons', $1::jsonb)
         on conflict (key) do update set value = excluded.value`,
      [JSON.stringify(ladder)],
    );
    const o = await placeOrder(a, f, null, "");
    await a.query("update orders set subtotal = 500000 where id = $1", [o.id]);
    const g = await a.query("select grant_reward_coupon($1) as code", [o.id]);
    check("null", g.rows[0].code === null);
  });

  // ── Зэрэг ашиглалт: хоёр холболт ────────────────────────────────────
  console.log("\nЗэрэг ашиглалт (row lock)");
  const code = `${tag}-RACE`;
  try {
    await insertCoupon(a, code, f.owner); // commit — B харах ёстой
    await a.query("begin");
    const first = await placeOrder(a, f, f.friend, code, 0);
    check(
      "A хөнгөлөлт авсан (түгжээ барьж байна)",
      first.discount === 1000,
      first,
    );

    await b.query("begin");
    await b.query("set local lock_timeout = '1500ms'");
    let blocked = false;
    try {
      await placeOrder(b, f, f.owner, code, 1);
    } catch (e) {
      blocked = (e as { code?: string }).code === "55P03";
    }
    await b.query("rollback");
    check("B купоны мөр дээр хүлээсэн (lock_timeout)", blocked);
    await a.query("rollback");
  } finally {
    await a.query("delete from coupons where code = $1", [code]);
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
