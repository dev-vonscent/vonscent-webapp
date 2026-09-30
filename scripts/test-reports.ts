/**
 * Санхүүгийн тайлангийн integration тест (docs/planning/report-audit.md) —
 * бодит Postgres дээр.
 *
 *   pnpm db:test-reports-dev      # зөвхөн .env.dev
 *
 * Vitest-д ороогүй шалтгаан нь test-coupons.ts-тэй ижил: `place_order`,
 * `mark_order_paid`, trigger-үүд болон row lock-ийг mock-оор шалгах боломжгүй.
 *
 * Тусгаарлалт: бүх fixture нь 2031 онд (`created_at`-ийг гараар тавина) ба
 * `AUDIT-…` брэндтэй — тайлангийн aggregate нь тэр мужид зөвхөн тестийн
 * өгөгдлийг л харна. Сценари бүр `begin … rollback` дотор явна. Цорын ганц
 * commit нь зэрэг үйлдлийн (K2) бараа + зочны захиалга бөгөөд `finally`
 * дотор устгагдана.
 *
 * Тест бүр INVARIANT-ыг шалгана — өөрөөр хэлбэл «ийм байх ёстой» гэснийг.
 * ✖ гарвал тэр нь аудитын олдвор (F-дугаар нь report-audit.md-д), кодын
 * алдаа биш тестийнх гэж бүү засаарай.
 */
import type { Client } from "pg";
import { connectDb } from "./db";
import { ubIso, ubIsoEnd } from "../src/features/admin/lib/date-range";
import { QPAY_FEE_PCT } from "../src/lib/constants";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(
      `  ✖ ${name}`,
      detail === undefined ? "" : JSON.stringify(detail),
    );
  }
}

/**
 * Бизнесийн шийдвэрээс (report-audit.md §3) хамаарах зан төлөв: зөв/буруу
 * гэж дүгнэхгүй, одоогийн утгыг л тэмдэглэнэ.
 */
function observe(name: string, value: unknown) {
  console.log(`  ⓘ ${name}:`, JSON.stringify(value));
}

// ── Fixture ──────────────────────────────────────────────────────────────

interface Ctx {
  staff: string;
  customer: string;
  tag: string;
}

interface Product {
  id: string;
  brand: string;
  v5: string;
  v10: string;
}

/** 2031 оны UB хананы цаг → timestamptz. */
const at = (local: string) => `${local}+08:00`;

async function makeProduct(
  c: Client,
  ctx: Ctx,
  key: string,
  {
    bottlePrice = 300_000,
    bottleMl = 100,
    onHand = 100,
    createdAt = "2031-01-05T10:00:00",
  } = {},
): Promise<Product> {
  const brand = `AUDIT-${ctx.tag}-${key}`;
  const p = await c.query<{ id: string }>(
    `insert into products (slug, name, brand, bottle_price, bottle_ml, is_active, created_at)
     values ($1, $2, $3, $4, $5, true, $6) returning id`,
    [
      `audit-${ctx.tag}-${key}`.toLowerCase(),
      `Audit ${key}`,
      brand,
      bottlePrice,
      bottleMl,
      at(createdAt),
    ],
  );
  const id = p.rows[0].id;
  const v = await c.query<{ id: string; ml: number }>(
    `insert into product_variants (product_id, ml, price, is_active)
     values ($1, 5, 50000, true), ($1, 10, 90000, true) returning id, ml`,
    [id],
  );
  await c.query(
    `insert into inventory (product_id, on_hand_ml) values ($1, $2)
     on conflict (product_id) do update set on_hand_ml = excluded.on_hand_ml, reserved_ml = 0`,
    [id, onHand],
  );
  return {
    id,
    brand,
    v5: v.rows.find((r) => r.ml === 5)!.id,
    v10: v.rows.find((r) => r.ml === 10)!.id,
  };
}

interface Line {
  p: Product;
  ml: 5 | 10;
  qty?: number;
}

async function placeOrder(
  c: Client,
  {
    user = null,
    lines,
    shipping = 5000,
    coupon = "",
    loyalty = 0,
    createdAt,
  }: {
    user?: string | null;
    lines: Line[];
    shipping?: number;
    coupon?: string;
    loyalty?: number;
    createdAt: string;
  },
) {
  const { rows } = await c.query<{ r: { order_id: string } }>(
    "select place_order($1::jsonb, $2::jsonb) as r",
    [
      JSON.stringify({
        user_id: user,
        contact_name: "Report audit",
        contact_phone: "99000000",
        ship_detail: "test",
        shipping_fee: shipping,
        coupon_code: coupon,
        loyalty_used: loyalty,
      }),
      JSON.stringify(
        lines.map((l) => ({
          product_id: l.p.id,
          variant_id: l.ml === 5 ? l.p.v5 : l.p.v10,
          ml: l.ml,
          qty: l.qty ?? 1,
        })),
      ),
    ],
  );
  const id = rows[0].r.order_id;
  await c.query("update orders set created_at = $2 where id = $1", [
    id,
    at(createdAt),
  ]);
  return id;
}

const pay = (c: Client, id: string) =>
  c.query("select mark_order_paid($1, null, 'manual')", [id]);
const setStatus = (c: Client, id: string, s: string) =>
  c.query("select update_order_status($1, $2::order_status_t, '', null)", [
    id,
    s,
  ]);
async function refund(
  c: Client,
  id: string,
  fee = 0,
  restock: boolean | null = null,
) {
  const { rows } = await c.query<{
    r: { ok: boolean; reason?: string; already?: boolean };
  }>("select mark_order_refunded($1, null, $2, $3) as r", [id, fee, restock]);
  return rows[0].r;
}

async function orderRow(c: Client, id: string) {
  const { rows } = await c.query<{
    subtotal: number;
    gross_subtotal: number | null;
    shipping_fee: number;
    discount: number;
    loyalty_used: number;
    total: number;
    status: string;
    payment_status: string;
  }>(
    `select subtotal, gross_subtotal, shipping_fee, discount, loyalty_used, total,
            status::text, payment_status::text from orders where id = $1`,
    [id],
  );
  return rows[0];
}

async function inv(c: Client, p: Product) {
  const { rows } = await c.query<{ on_hand_ml: number; reserved_ml: number }>(
    "select on_hand_ml, reserved_ml from inventory where product_id = $1",
    [p.id],
  );
  return rows[0];
}

async function profile(c: Client, user: string) {
  const { rows } = await c.query<{
    loyalty_points: number;
    pending_points: number;
  }>("select loyalty_points, pending_points from profiles where id = $1", [
    user,
  ]);
  return rows[0];
}

/** Тайлангийн хуудас (`getReportData`) ба экспортын (`export/route.ts`) толь. */
async function report(
  c: Client,
  from?: string,
  to?: string,
  bucket: "day" | "month" = "month",
) {
  const f = ubIso(from) ?? null;
  const t = ubIsoEnd(to) ?? null;
  const fin = (
    await c.query<Record<string, string>>(
      "select * from admin_report_finance($1, $2, $3)",
      [f, t, QPAY_FEE_PCT],
    )
  ).rows[0];
  const n = (k: string) => Number(fin[k]);
  const series = (
    await c.query<{
      bucket: string;
      revenue: string;
      orders: string;
      ml: string;
    }>("select * from admin_report_series($1, $2, $3, $4)", [
      f,
      t,
      bucket,
      QPAY_FEE_PCT,
    ])
  ).rows.map((r) => ({
    bucket: r.bucket,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
    ml: Number(r.ml),
  }));
  const top = (
    await c.query<{ revenue: string }>(
      "select * from admin_report_top_products(1000, $1, $2)",
      [f, t],
    )
  ).rows;
  const brands = (
    await c.query<{ revenue: string }>(
      "select * from admin_report_top_brands($1, $2)",
      [f, t],
    )
  ).rows;
  const status = (
    await c.query<{ status: string; count: string }>(
      "select * from admin_report_status($1, $2)",
      [f, t],
    )
  ).rows;
  // export/route.ts «sales» = admin_report_events-ийн мөрүүд.
  const ev = (
    await c.query<{ n: string; net: string; sales: string }>(
      `select count(*) n, coalesce(sum(net_goods),0) net,
              count(*) filter (where kind = 'sale') sales
         from admin_report_events($1, $2, $3)`,
      [f, t, QPAY_FEE_PCT],
    )
  ).rows[0];
  return {
    goods: n("goods"),
    coupon: n("coupon"),
    points: n("points"),
    refunds: n("refunds"),
    revenue: n("net_sales"),
    shipping: n("shipping"),
    qpayFee: n("qpay_fee"),
    refundFee: n("refund_fee"),
    cost: n("purchases"),
    profit: n("profit"),
    paidOrders: n("sale_orders"),
    pendingRefund: n("pending_refund_orders"),
    series,
    seriesRevenue: series.reduce((s, r) => s + r.revenue, 0),
    seriesOrders: series.reduce((s, r) => s + r.orders, 0),
    topRevenue: top.reduce((s, r) => s + Number(r.revenue), 0),
    brandRevenue: brands.reduce((s, r) => s + Number(r.revenue), 0),
    status: Object.fromEntries(status.map((s) => [s.status, Number(s.count)])),
    export: {
      rows: Number(ev.n),
      net: Number(ev.net),
      sales: Number(ev.sales),
    },
  };
}

const Y = { from: "2031-01-01T00:00", to: "2031-12-31T23:59" };
const JAN = { from: "2031-01-01T00:00", to: "2031-01-31T23:59" };
const FEB = { from: "2031-02-01T00:00", to: "2031-02-28T23:59" };

async function scenario(
  c: Client,
  ctx: Ctx,
  name: string,
  fn: () => Promise<void>,
) {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    // Тайлангийн функцууд `is_staff()`-оор хаалттай — staff-ийн JWT-г
    // транзакцын хүрээнд л тавина.
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: ctx.staff, role: "authenticated" }),
    ]);
    await fn();
  } catch (e) {
    failures.push(`${name}: алдаа`);
    console.log("  ✖ алдаа:", (e as Error).message);
  } finally {
    await c.query("rollback");
  }
}

async function givePoints(c: Client, user: string, points: number) {
  await c.query(
    "update profiles set loyalty_points = $2, pending_points = 0 where id = $1",
    [user, points],
  );
}

async function insertCoupon(
  c: Client,
  code: string,
  owner: string,
  value: number,
) {
  await c.query(
    `insert into coupons (code, user_id, type, value, min_subtotal, max_uses, is_active)
     values ($1, $2, 'fixed', $3, 0, 1, true)`,
    [code, owner, value],
  );
}

// ── Сценариуд ────────────────────────────────────────────────────────────

async function main() {
  const a = await connectDb(url!);
  const b = await connectDb(url!, false);

  const staff = await a.query<{ id: string }>(
    "select id from profiles where role in ('super_admin','operator') order by created_at limit 1",
  );
  const cust = await a.query<{ id: string }>(
    "select id from profiles where role = 'customer' order by created_at limit 1",
  );
  if (!staff.rows[0] || !cust.rows[0]) {
    throw new Error("Dev санд staff ба customer хэрэглэгч хэрэгтэй.");
  }
  const ctx: Ctx = {
    staff: staff.rows[0].id,
    customer: cust.rows[0].id,
    tag: Date.now().toString(36).toUpperCase(),
  };

  // Урьдчилсан шалгалт: 2031 онд өөр өгөгдөл байвал тусгаарлалт эвдэрнэ.
  const clash = await a.query<{ n: string }>(
    `select (select count(*) from orders where created_at >= '2031-01-01') +
            (select count(*) from products where created_at >= '2031-01-01') +
            (select count(*) from restock_log where created_at >= '2031-01-01') n`,
  );
  if (Number(clash.rows[0].n) > 0) {
    throw new Error("Dev санд 2031 оны өгөгдөл байна — тусгаарлалт эвдэрнэ.");
  }

  await scenario(a, ctx, "A) Энгийн захиалга → төлсөн → хүргэсэн", async () => {
    const p = await makeProduct(a, ctx, "A");
    const id = await placeOrder(a, {
      user: ctx.customer,
      lines: [{ p, ml: 10 }],
      createdAt: "2031-01-10T12:00:00",
    });
    let r = await report(a, Y.from, Y.to);
    check(
      "төлөөгүй захиалга орлогод 0",
      r.revenue === 0 && r.paidOrders === 0,
      r,
    );
    check(
      "төлөөгүй захиалга reserve хийсэн",
      (await inv(a, p)).reserved_ml === 10,
    );

    await pay(a, id);
    await setStatus(a, id, "shipping");
    await setStatus(a, id, "delivered");
    const o = await orderRow(a, id);
    r = await report(a, Y.from, Y.to);
    check(
      "total = subtotal + shipping − discount − loyalty",
      o.total === o.subtotal + o.shipping_fee - o.discount - o.loyalty_used,
      o,
    );
    check(
      "борлуулалт = 90,000 (хүргэлт ороогүй)",
      r.revenue === 90_000,
      r.revenue,
    );
    check("төлсөн захиалга = 1", r.paidOrders === 1);
    check(
      "totals == Σ series (сар)",
      r.revenue === r.seriesRevenue && r.paidOrders === r.seriesOrders,
      r.series,
    );
    check("series-ийн ml = 10", r.series[0]?.ml === 10, r.series);
    check(
      "series bucket = 2031-01",
      r.series[0]?.bucket === "2031-01",
      r.series,
    );
    check("top products Σ == борлуулалт", r.topRevenue === r.revenue, {
      top: r.topRevenue,
      revenue: r.revenue,
    });
    check(
      "[F2] export CSV «Цэвэр борлуулалт» Σ == тайлангийн борлуулалт",
      r.export.net === r.revenue,
      { exportNet: r.export.net, revenue: r.revenue },
    );
    check(
      "export-ийн борлуулалтын мөр == төлсөн захиалга",
      r.export.sales === r.paidOrders,
    );
    check(
      "QPay шимтгэл = нийт 95,000-ийн 1% = 950",
      r.qpayFee === 950,
      r.qpayFee,
    );
    check("хүргэлт 5,000 мэдээлэлд, борлуулалтад ороогүй", r.shipping === 5000);
    const i = await inv(a, p);
    check(
      "commit: on_hand 100 → 90, reserved 0",
      i.on_hand_ml === 90 && i.reserved_ml === 0,
      i,
    );
    check("зардал = эх савны үнэ 300,000", r.cost === 300_000, r.cost);
    check(
      "ашиг = 90,000 − 950 − 300,000",
      r.profit === 90_000 - 950 - 300_000,
      r.profit,
    );
    const earn = await a.query<{ delta: number; released: boolean }>(
      "select delta, released from loyalty_ledger where order_id = $1 and reason = 'earn'",
      [id],
    );
    check(
      "оноо 900 олгож, хүргэлтээр нээгдсэн",
      earn.rows[0]?.delta === 900 && earn.rows[0]?.released,
      earn.rows,
    );
  });

  await scenario(a, ctx, "B) Купон + V-point-той захиалга", async () => {
    const p = await makeProduct(a, ctx, "B");
    await givePoints(a, ctx.customer, 5000);
    await insertCoupon(a, `AUD-${ctx.tag}-B`, ctx.customer, 10_000);
    const id = await placeOrder(a, {
      user: ctx.customer,
      lines: [
        { p, ml: 10 },
        { p, ml: 5 },
      ],
      coupon: `AUD-${ctx.tag}-B`,
      loyalty: 5000,
      createdAt: "2031-01-11T12:00:00",
    });
    await pay(a, id);
    const o = await orderRow(a, id);
    const r = await report(a, Y.from, Y.to);
    check(
      "купон 10,000, оноо 5,000 хасагдсан",
      o.discount === 10_000 && o.loyalty_used === 5000,
      o,
    );
    check(
      "gross − discount − points + shipping = total",
      (o.gross_subtotal ?? 0) - o.discount - o.loyalty_used + o.shipping_fee ===
        o.total,
      o,
    );
    check(
      "борлуулалт = 140,000 − 10,000 − 5,000 = 125,000 (давхар хасалтгүй)",
      r.revenue === 125_000,
      r.revenue,
    );
    check(
      "борлуулалт == total − shipping",
      r.revenue === o.total - o.shipping_fee,
    );
    check("totals == Σ series", r.revenue === r.seriesRevenue);
    observe("[F3] top brands Σ (купон/оноо хасаагүй) vs борлуулалт", {
      brands: r.brandRevenue,
      revenue: r.revenue,
    });
    check(
      "задаргаа: 140,000 − 10,000 − 5,000",
      r.goods === 140_000 && r.coupon === 10_000 && r.points === 5000,
      r,
    );
    check("[F2] export Σ == борлуулалт", r.export.net === r.revenue, r.export);
    const pr = await profile(a, ctx.customer);
    check("оноо 5,000 → 0", pr.loyalty_points === 0, pr);
    const earn = await a.query<{ delta: number }>(
      "select delta from loyalty_ledger where order_id = $1 and reason = 'earn'",
      [id],
    );
    // Шаардлага: «Купон ашиглавал хямдралын дараах үнээс оноо цуглуулна».
    // Оноогоор төлсөн хэсгээс оноо олгох эсэх нь бизнесийн асуулт (Q5).
    observe(
      "[F7] олгосон оноо (оноогоор төлсөн 5,000-аас ч оноо бодсон эсэх; 1,250 бол бодоогүй)",
      earn.rows[0]?.delta,
    );
  });

  await scenario(
    a,
    ctx,
    "C) Бараа бүхэлдээ оноогоор (0₮ бараа, зөвхөн хүргэлт)",
    async () => {
      const p = await makeProduct(a, ctx, "C");
      await givePoints(a, ctx.customer, 200_000);
      const id = await placeOrder(a, {
        user: ctx.customer,
        lines: [{ p, ml: 10 }],
        loyalty: 999_999,
        createdAt: "2031-01-12T12:00:00",
      });
      await pay(a, id);
      const o = await orderRow(a, id);
      const r = await report(a, Y.from, Y.to);
      check(
        "оноо барааны дүнгээр хязгаарлагдсан (90,000)",
        o.loyalty_used === 90_000,
        o,
      );
      check("total = зөвхөн хүргэлт 5,000", o.total === 5000, o);
      check("борлуулалт = 0", r.revenue === 0, r.revenue);
      check("төлсөн захиалгад тоологдсон (1)", r.paidOrders === 1);
      check(
        "series-д 0₮ мөр үлдсэн (orders=1, revenue=0)",
        r.series[0]?.orders === 1 && r.series[0]?.revenue === 0,
        r.series,
      );
      check("series ml = 10 (ml гарсан)", r.series[0]?.ml === 10);
      const earn = await a.query<{ delta: number }>(
        "select delta from loyalty_ledger where order_id = $1 and reason = 'earn'",
        [id],
      );
      observe(
        "[F7] бүтэн оноогоор төлсөн захиалгад олгосон оноо",
        earn.rows[0]?.delta ?? 0,
      );
    },
  );

  await scenario(a, ctx, "D) Төлөхөөс өмнө цуцлах (купон + оноо)", async () => {
    const p = await makeProduct(a, ctx, "D");
    await givePoints(a, ctx.customer, 5000);
    const code = `AUD-${ctx.tag}-D`;
    await insertCoupon(a, code, ctx.customer, 10_000);
    const id = await placeOrder(a, {
      user: ctx.customer,
      lines: [{ p, ml: 10 }],
      coupon: code,
      loyalty: 5000,
      createdAt: "2031-01-13T12:00:00",
    });
    await setStatus(a, id, "cancelled");
    const r = await report(a, Y.from, Y.to);
    check(
      "орлогод 0, төлсөн захиалга 0",
      r.revenue === 0 && r.paidOrders === 0,
      r,
    );
    check("status тоолуурт cancelled = 1", r.status.cancelled === 1, r.status);
    const i = await inv(a, p);
    check(
      "reserve release: on_hand 100, reserved 0",
      i.on_hand_ml === 100 && i.reserved_ml === 0,
      i,
    );
    const cp = await a.query<{ used_count: number }>(
      "select used_count from coupons where code = $1",
      [code],
    );
    check(
      "купон буцаж идэвхжсэн (used_count 0)",
      cp.rows[0].used_count === 0,
      cp.rows[0],
    );
    check(
      "оноо буцсан (5,000)",
      (await profile(a, ctx.customer)).loyalty_points === 5000,
    );
  });

  await scenario(a, ctx, "E) Төлсний дараа цуцлах → refund", async () => {
    const p = await makeProduct(a, ctx, "E");
    await givePoints(a, ctx.customer, 5000);
    const id = await placeOrder(a, {
      user: ctx.customer,
      lines: [{ p, ml: 10 }],
      loyalty: 5000,
      createdAt: "2031-01-14T12:00:00",
    });
    await pay(a, id);
    await setStatus(a, id, "cancelled");
    let r = await report(a, Y.from, Y.to);
    // Шийдвэр (2026-10-01): мөнгө дансанд байгаа тул буцаалт бүртгэгдтэл
    // борлуулалтад, «буцаалт хүлээж буй» мэдээлэлтэй.
    check(
      "[F4] буцаалт хүлээж буй захиалга борлуулалтад (85,000) + мэдээлэл",
      r.revenue === 85_000 && r.pendingRefund === 1,
      r,
    );
    const i = await inv(a, p);
    check(
      "commit хийсэн ml буцсан: on_hand 100",
      i.on_hand_ml === 100 && i.reserved_ml === 0,
      i,
    );
    const pr = await profile(a, ctx.customer);
    check(
      "ашигласан оноо буцсан, олсон pending хасагдсан",
      pr.loyalty_points === 5000 && pr.pending_points === 0,
      pr,
    );

    const first = await refund(a, id, 900);
    const again = await refund(a, id);
    // Бодит буцаалт нь `now()` — fixture-ийн сард шилжүүлнэ.
    await a.query("update orders set refunded_at = $2 where id = $1", [
      id,
      at("2031-01-14T15:00:00"),
    ]);
    r = await report(a, Y.from, Y.to);
    check("refund ok", first.ok === true, first);
    check(
      "[K] давхар refund idempotent (already)",
      again.ok === true && again.already === true,
      again,
    );
    const hist = await a.query<{ n: string }>(
      "select count(*) n from order_status_history where order_id = $1 and note = 'Төлбөр буцаагдсан'",
      [id],
    );
    check(
      "[K] түүхэнд нэг л «Төлбөр буцаагдсан» мөр",
      Number(hist.rows[0].n) === 1,
    );
    check(
      "нэг сард төлж, буцаавал цэвэр борлуулалт 0",
      r.revenue === 0 && r.refunds === 85_000,
      r,
    );
    check(
      "суутгал 900 ашигт үлдсэн",
      r.refundFee === 900 && r.profit === 900 - r.qpayFee - r.cost,
      r,
    );
    const o = await orderRow(a, id);
    check("буцаасан дүн = total − суутгал", o.total - 900 === 89_100, o);

    await setStatus(a, id, "cancelled");
    check(
      "[K] давхар цуцлалт on_hand-ийг давхар нэмэхгүй",
      (await inv(a, p)).on_hand_ml === 100,
    );
  });

  await scenario(a, ctx, "F) Хүргэсний дараа refund (дараа сард)", async () => {
    await a.query(
      `update settings set value = jsonb_set(value, '{autoGrant}',
         '{"enabled":true,"minTotal":50000,"type":"percent","value":10,"validDays":30,"maxUsesPerUser":1}'::jsonb)
       where key = 'coupons'`,
    );
    const p = await makeProduct(a, ctx, "F");
    const id = await placeOrder(a, {
      user: ctx.customer,
      lines: [{ p, ml: 10 }],
      createdAt: "2031-01-20T12:00:00",
    });
    await givePoints(a, ctx.customer, 0);
    await pay(a, id);
    await setStatus(a, id, "shipping");
    await setStatus(a, id, "delivered");
    const janBefore = await report(a, JAN.from, JAN.to);
    const cpBefore = await a.query(
      "select 1 from coupons where source_order_id = $1",
      [id],
    );
    check("урамшууллын купон олгогдсон байсан", cpBefore.rowCount === 1);
    const noChoice = await refund(a, id);
    check(
      "декантын сонголтгүй бол татгалзана (RESTOCK_REQUIRED)",
      noChoice.ok === false && noChoice.reason === "RESTOCK_REQUIRED",
      noChoice,
    );
    const res = await refund(a, id, 0, false);
    // Бодит байдалд refund нь 2-р сард хийгдэнэ; history-ийн огноог
    // ч тэр сард шилжүүлнэ.
    await a.query("update orders set refunded_at = $2 where id = $1", [
      id,
      at("2031-02-05T10:00:00"),
    ]);
    const janAfter = await report(a, JAN.from, JAN.to);
    const feb = await report(a, FEB.from, FEB.to);
    check("delivered → refund зөвшөөрөгдсөн (0094)", res.ok === true, res);
    check(
      "1-р сар refund-оос өмнө 90,000",
      janBefore.revenue === 90_000,
      janBefore.revenue,
    );
    check(
      "[F6] өнгөрсөн сарын тоо refund-оор өөрчлөгдөхгүй",
      janAfter.revenue === janBefore.revenue,
      { before: janBefore.revenue, after: janAfter.revenue },
    );
    check(
      "[F6] буцаалт хийсэн 2-р сард −90,000",
      feb.revenue === -90_000 && feb.refunds === 90_000,
      feb,
    );
    check(
      "[F6] 2-р сарын series-д −90,000",
      feb.seriesRevenue === -90_000,
      feb.series,
    );
    check(
      "net: 1-р сар + 2-р сар = 0 (буцаасан захиалга орлогогүй)",
      janAfter.revenue + feb.revenue === 0,
    );
    const i = await inv(a, p);
    check("зарах боломжгүй: ml нөөцөд буцаагүй (90)", i.on_hand_ml === 90, i);
    const note = await a.query<{ note: string }>(
      "select note from order_status_history where order_id = $1 and note like 'Төлбөр буцаагдсан%'",
      [id],
    );
    check(
      "түүхэнд хасагдсан 10ml тайлбартай",
      note.rows[0]?.note.includes("10ml") === true,
      note.rows,
    );
    check(
      "2-р сарын «Зарсан мл»-ээс −10",
      feb.series[0]?.ml === -10,
      feb.series,
    );
    const pr = await profile(a, ctx.customer);
    check(
      "[F8] бүтэн буцаалтын дараа олсон 900 оноо хасагдсан",
      pr.loyalty_points === 0,
      pr,
    );
    const cp = await a.query<{ is_active: boolean }>(
      "select is_active from coupons where source_order_id = $1",
      [id],
    );
    check(
      "[F8] ашиглаагүй урамшууллын купон хүчингүй (устгагдсан)",
      cp.rows.every((r) => !r.is_active),
      cp.rows,
    );
  });

  await scenario(
    a,
    ctx,
    "F2) Хүргэсний дараа refund — декант нөөцөд буцсан",
    async () => {
      const p = await makeProduct(a, ctx, "F2");
      await givePoints(a, ctx.customer, 5000);
      const id = await placeOrder(a, {
        user: ctx.customer,
        lines: [{ p, ml: 10 }],
        loyalty: 5000,
        createdAt: "2031-01-22T12:00:00",
      });
      await pay(a, id);
      await setStatus(a, id, "shipping");
      await setStatus(a, id, "delivered");
      const before = await report(a, Y.from, Y.to);
      const res = await refund(a, id, 0, true);
      await a.query("update orders set refunded_at = $2 where id = $1", [
        id,
        at("2031-01-25T10:00:00"),
      ]);
      const after = await report(a, Y.from, Y.to);
      check("refund ok", res.ok === true, res);
      check("ml нөөцөд буцсан (100)", (await inv(a, p)).on_hand_ml === 100);
      const log = await a.query<{
        cost: number;
        delta_ml: number;
        order_id: string;
      }>(
        "select cost, delta_ml, order_id from restock_log where product_id = $1 and reason = 'refund_return'",
        [p.id],
      );
      check(
        "restock_log: +10ml, өртөг 0, захиалгатай холбоотой",
        log.rows.length === 1 &&
          log.rows[0].cost === 0 &&
          log.rows[0].delta_ml === 10 &&
          log.rows[0].order_id === id,
        log.rows,
      );
      check("худалдан авалт өөрчлөгдөөгүй", after.cost === before.cost, {
        before: before.cost,
        after: after.cost,
      });
      check("цэвэр борлуулалт 0", after.revenue === 0, after.revenue);
      const pr = await profile(a, ctx.customer);
      check(
        "ашигласан 5,000 оноо буцсан, олсон 900 хасагдсан",
        pr.loyalty_points === 5000,
        pr,
      );
      const o = await a.query<{ refund_restocked: boolean }>(
        "select refund_restocked from orders where id = $1",
        [id],
      );
      check("refund_restocked = true", o.rows[0].refund_restocked === true);
    },
  );

  await scenario(
    a,
    ctx,
    "G) Оноо нээгдэж, зарцуулагдсаны дараа цуцлах",
    async () => {
      const p = await makeProduct(a, ctx, "G");
      await givePoints(a, ctx.customer, 0);
      const id = await placeOrder(a, {
        user: ctx.customer,
        lines: [{ p, ml: 10 }],
        createdAt: "2031-01-21T12:00:00",
      });
      await pay(a, id);
      await setStatus(a, id, "shipping");
      await setStatus(a, id, "delivered");
      check(
        "хүргэлтээр 900 оноо нээгдсэн",
        (await profile(a, ctx.customer)).loyalty_points === 900,
      );
      // Хэрэглэгч оноогоо өөр захиалгад зарцуулсан.
      await givePoints(a, ctx.customer, 0);
      // super_admin сэргээлт: delivered → shipping → cancelled.
      await setStatus(a, id, "shipping");
      await setStatus(a, id, "cancelled");
      const pr = await profile(a, ctx.customer);
      check("оноо сөрөг болоогүй (≥ 0)", pr.loyalty_points >= 0, pr);
      const rev = await a.query<{ delta: number }>(
        "select delta from loyalty_ledger where order_id = $1 and reason = 'cancel_reverse'",
        [id],
      );
      observe(
        "[F9] cancel_reverse-ийн бодит хасалт (олгосон 900)",
        rev.rows[0]?.delta,
      );
      const r = await report(a, Y.from, Y.to);
      check(
        "[F4] буцаагдаагүй захиалга борлуулалтад, мэдээлэлд",
        r.revenue === 90_000 && r.pendingRefund === 1,
        r,
      );
    },
  );

  await scenario(
    a,
    ctx,
    "H) Хоёр өөр үнээр restock → борлуулалт → ашиг",
    async () => {
      const p = await makeProduct(a, ctx, "H", { onHand: 100 });
      await a.query(
        "select restock_inventory($1, 100, 'restock', null, 250000)",
        [p.id],
      );
      await a.query(
        "select restock_inventory($1, 100, 'restock', null, 350000)",
        [p.id],
      );
      await a.query(
        "update restock_log set created_at = $2 where product_id = $1",
        [p.id, at("2031-01-06T10:00:00")],
      );
      const id = await placeOrder(a, {
        lines: [{ p, ml: 10, qty: 2 }],
        createdAt: "2031-02-10T12:00:00",
      });
      await pay(a, id);
      const all = await report(a, Y.from, Y.to);
      const jan = await report(a, JAN.from, JAN.to);
      const feb = await report(a, FEB.from, FEB.to);
      check(
        "on_hand = 100 + 100 + 100 − 20 = 280",
        (await inv(a, p)).on_hand_ml === 280,
      );
      check(
        "жилийн зардал = 300k + 250k + 350k = 900,000",
        all.cost === 900_000,
        all.cost,
      );
      check(
        "сар бүрийн зардлын нийлбэр == жилийнх",
        jan.cost + feb.cost === all.cost,
      );
      // 300ml-т 900,000₮ → дундаж 3,000₮/ml; 20ml зарсан → COGS 60,000.
      observe("[F1] сар бүрийн ашиг (худалдан авалтын сард зардал)", {
        jan: jan.profit,
        feb: feb.profit,
      });

      // Барааны эх савны үнийг засахад өнгөрсөн зардал өөрчлөгдөх эсэх.
      await a.query("update products set bottle_price = 400000 where id = $1", [
        p.id,
      ]);
      const jan2 = await report(a, JAN.from, JAN.to);
      // Эх савны үнийг засах = анх бичсэн үнийн алдааг засах (0111).
      check(
        "bottle_price засвар 'initial' мөрийг шинэчилнэ (+100,000)",
        jan2.cost === jan.cost + 100_000,
        { before: jan.cost, after: jan2.cost },
      );

      // Зарагдсан барааг устгахад.
      await a.query("delete from products where id = $1", [p.id]);
      const all2 = await report(a, Y.from, Y.to);
      check("устгасны дараа борлуулалт хэвээр", all2.revenue === all.revenue);
      check(
        "[F10] зарагдсан барааг устгахад зардал алга болохгүй",
        all2.cost === all.cost + 100_000,
        { before: all.cost, after: all2.cost },
      );
    },
  );

  await scenario(a, ctx, "I) Сөрөг засвар (correction) → зардал", async () => {
    const p = await makeProduct(a, ctx, "I");
    await a.query("select restock_inventory($1, -20, 'correction', null, 0)", [
      p.id,
    ]);
    await a.query(
      "update restock_log set created_at = $2 where product_id = $1",
      [p.id, at("2031-01-07T10:00:00")],
    );
    let r = await report(a, Y.from, Y.to);
    check("on_hand 100 → 80", (await inv(a, p)).on_hand_ml === 80);
    check(
      "засвар зардлыг өөрчлөхгүй (300,000 хэвээр, сөрөг биш)",
      r.cost === 300_000,
      r.cost,
    );
    // RPC нь хасалтад өртөг бүртгэхийг өөрөө хориглодоггүй — зөвхөн route.
    await a.query(
      "select restock_inventory($1, -10, 'correction', null, 5000)",
      [p.id],
    );
    await a.query(
      "update restock_log set created_at = $2 where product_id = $1",
      [p.id, at("2031-01-07T10:00:00")],
    );
    r = await report(a, Y.from, Y.to);
    check(
      "[F12] RPC түвшинд хасалтын өртөг зардалд орохгүй",
      r.cost === 300_000,
      r.cost,
    );

    await placeOrder(a, {
      lines: [{ p, ml: 10 }],
      createdAt: "2031-01-15T12:00:00",
    });
    let floor = false;
    try {
      await a.query("savepoint s");
      await a.query(
        "select restock_inventory($1, -65, 'correction', null, 0)",
        [p.id],
      );
    } catch (e) {
      floor = (e as Error).message.includes("RESERVED_FLOOR");
      await a.query("rollback to savepoint s");
    }
    check("reserved-ээс доош хасахыг татгалзсан (RESERVED_FLOOR)", floor);
    const i = await inv(a, p);
    check(
      "on_hand ≥ reserved ≥ 0",
      i.on_hand_ml >= i.reserved_ml && i.reserved_ml >= 0,
      i,
    );
  });

  await scenario(
    a,
    ctx,
    "I2) Сэргээсэн (cancelled → pending) захиалгыг төлөхөд reserve тэнцвэр",
    async () => {
      const p = await makeProduct(a, ctx, "I2");
      const o1 = await placeOrder(a, {
        lines: [{ p, ml: 10 }],
        createdAt: "2031-01-16T12:00:00",
      });
      await setStatus(a, o1, "cancelled");
      await setStatus(a, o1, "pending"); // super_admin recovery
      const o2 = await placeOrder(a, {
        lines: [{ p, ml: 10 }],
        createdAt: "2031-01-16T13:00:00",
      });
      await pay(a, o1);
      const i = await inv(a, p);
      // o2 төлөгдөөгүй, 10ml барьсан хэвээр байх ёстой.
      check(
        "[F11] reserved_ml == төлөгдөөгүй идэвхтэй захиалгын ml (10)",
        i.reserved_ml === 10,
        { ...i, pendingOrder: o2 },
      );
    },
  );

  await scenario(
    a,
    ctx,
    "I3) Үлдэгдэл хүрэхгүй бол сэргээлтийг татгалзана",
    async () => {
      const p = await makeProduct(a, ctx, "I3", { onHand: 10 });
      const o1 = await placeOrder(a, {
        lines: [{ p, ml: 10 }],
        createdAt: "2031-01-17T12:00:00",
      });
      await setStatus(a, o1, "cancelled");
      await placeOrder(a, {
        lines: [{ p, ml: 10 }],
        createdAt: "2031-01-17T13:00:00",
      });
      let refused = false;
      try {
        await a.query("savepoint s");
        await setStatus(a, o1, "pending");
      } catch (e) {
        refused = (e as Error).message.includes("INSUFFICIENT_STOCK");
        await a.query("rollback to savepoint s");
      }
      check("сэргээлт INSUFFICIENT_STOCK-оор татгалзсан", refused);
      const i = await inv(a, p);
      check("reserved хэвээр 10 (нөгөө захиалгынх)", i.reserved_ml === 10, i);
      const o = await orderRow(a, o1);
      check("захиалга цуцлагдсан хэвээр", o.status === "cancelled", o);
    },
  );

  await scenario(
    a,
    ctx,
    "J) 23:30 УБ цагийн захиалга, сарын зааг",
    async () => {
      const p = await makeProduct(a, ctx, "J");
      const o1 = await placeOrder(a, {
        lines: [{ p, ml: 10 }],
        createdAt: "2031-01-31T23:30:00",
      });
      const o2 = await placeOrder(a, {
        lines: [{ p, ml: 5 }],
        createdAt: "2031-01-31T23:59:30",
      });
      const o3 = await placeOrder(a, {
        lines: [{ p, ml: 5 }],
        createdAt: "2031-02-01T00:10:00",
      });
      for (const id of [o1, o2, o3]) await pay(a, id);
      const jan = await report(a, JAN.from, JAN.to);
      const feb = await report(a, FEB.from, FEB.to);
      const all = await report(a, Y.from, Y.to);
      const days = await report(
        a,
        "2031-01-30T00:00",
        "2031-02-02T23:59",
        "day",
      );
      check(
        "23:30 УБ → 1-р сард (UTC-ээр 15:30)",
        jan.series.find((s) => s.bucket === "2031-01")?.orders !== undefined,
      );
      check(
        "00:10 УБ (UTC-ээр өмнөх өдөр) → 2-р сард",
        feb.revenue === 50_000,
        feb.revenue,
      );
      check(
        "өдрийн bucket: 01-31 = 2 захиалга, 02-01 = 1",
        days.series.find((s) => s.bucket === "2031-01-31")?.orders === 2 &&
          days.series.find((s) => s.bucket === "2031-02-01")?.orders === 1,
        days.series,
      );
      check(
        "жилийн series-ийн сар бүрийн нийлбэр == totals",
        all.seriesRevenue === all.revenue,
      );
      check(
        "[F13] 23:59:30-ийн захиалга «1-р сар» мужид багтана (to = T23:59)",
        jan.revenue === 140_000,
        { jan: jan.revenue, expected: 140_000 },
      );
      check(
        "[F13] 1-р сар + 2-р сар == жилийнх (заагт захиалга алдагдахгүй)",
        jan.revenue + feb.revenue === all.revenue,
        { jan: jan.revenue, feb: feb.revenue, all: all.revenue },
      );
    },
  );

  // ── K2: зэрэг цуцлалт / refund — хоёр холболт, commit хийсэн fixture ───
  console.log("\nK2) Зэрэг цуцлах + refund (row lock)");
  let pid: string | null = null;
  let oid: string | null = null;
  try {
    const p = await makeProduct(a, ctx, "K"); // autocommit
    pid = p.id;
    oid = await placeOrder(a, {
      lines: [{ p, ml: 10 }],
      createdAt: "2031-03-01T12:00:00",
    });
    await pay(a, oid);

    await a.query("begin");
    await setStatus(a, oid, "cancelled"); // мөрийг түгжиж байна

    await b.query("begin");
    await b.query("set local lock_timeout = '1500ms'");
    let blocked = false;
    try {
      await b.query("select update_order_status($1, 'cancelled', '', null)", [
        oid,
      ]);
    } catch (e) {
      blocked = (e as { code?: string }).code === "55P03";
    }
    await b.query("rollback");
    check("B-ийн зэрэг цуцлалт A-гийн түгжээг хүлээсэн", blocked);
    await a.query("commit");

    // A commit хийсний дараа B дахин цуцалж, хоёулаа refund дарна.
    await b.query("select update_order_status($1, 'cancelled', '', null)", [
      oid,
    ]);
    const [r1, r2] = await Promise.all([refund(a, oid), refund(b, oid)]);
    check(
      "зэрэг хоёр refund — нэг нь л бичсэн",
      [r1, r2].filter((r) => r.ok && !r.already).length === 1 &&
        [r1, r2].every((r) => r.ok),
      [r1, r2],
    );
    check(
      "on_hand нэг л удаа буцсан (100)",
      (await inv(a, p)).on_hand_ml === 100,
    );
  } catch (e) {
    failures.push("K2: алдаа");
    console.log("  ✖ алдаа:", (e as Error).message);
    await a.query("rollback").catch(() => {});
  } finally {
    if (oid) await a.query("delete from orders where id = $1", [oid]);
    // restock_log нь бараа устгахад үлддэг (0111) — тестийн мөрийг өөрөө цэвэрлэнэ.
    if (pid)
      await a.query("delete from restock_log where product_id = $1", [pid]);
    if (pid) await a.query("delete from products where id = $1", [pid]);
  }

  // ── Бодит dev өгөгдөл дээрх invariant (зөвхөн уншина) ─────────────────
  console.log("\nL) Dev сангийн одоогийн өгөгдөл дээрх invariant");
  await a.query("begin");
  try {
    await a.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: ctx.staff, role: "authenticated" }),
    ]);
    const badTotal = await a.query(
      `select order_no from orders
        where total <> greatest(subtotal + shipping_fee - discount - loyalty_used, 0)`,
    );
    check(
      "бүх захиалгад total = subtotal + shipping − discount − loyalty",
      badTotal.rowCount === 0,
      badTotal.rows.slice(0, 5),
    );
    const badInv = await a.query(
      "select product_id from inventory where on_hand_ml < 0 or reserved_ml < 0 or reserved_ml > on_hand_ml",
    );
    check(
      "inventory: 0 ≤ reserved ≤ on_hand",
      badInv.rowCount === 0,
      badInv.rowCount,
    );
    const drift = await a.query<{
      product_id: string;
      reserved_ml: number;
      expected: string;
    }>(
      `select i.product_id, i.reserved_ml, coalesce(x.ml, 0) expected
         from inventory i
         left join (
           select oi.product_id, sum(oi.ml * oi.qty) ml
             from order_items oi join orders o on o.id = oi.order_id
            where o.payment_status = 'unpaid' and o.status <> 'cancelled'
            group by oi.product_id
         ) x on x.product_id = i.product_id
        where i.reserved_ml <> coalesce(x.ml, 0)`,
    );
    check(
      "[F11] reserved_ml == төлөгдөөгүй идэвхтэй захиалгын ml",
      drift.rowCount === 0,
      drift.rows.slice(0, 5),
    );
    const all = await report(a);
    check(
      "totals(бүх хугацаа) == Σ series",
      all.revenue === all.seriesRevenue && all.paidOrders === all.seriesOrders,
      {
        revenue: all.revenue,
        series: all.seriesRevenue,
      },
    );
    const paidCancelled = await a.query(
      "select order_no from orders where status = 'cancelled' and payment_status = 'paid'",
    );
    console.log(
      `  · цуцлагдсан боловч буцаагдаагүй (paid) захиалга: ${paidCancelled.rowCount}`,
    );
  } finally {
    await a.query("rollback");
  }

  await a.end();
  await b.end();

  console.log(`\n${passed} тэнцсэн, ${failures.length} унасан.`);
  if (failures.length) {
    console.log("Унасан:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
