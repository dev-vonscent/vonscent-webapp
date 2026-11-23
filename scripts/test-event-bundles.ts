/**
 * Арга хэмжээнд орсон бэлэн багц (0190, task 16.7) — бодит Postgres
 * integration тест, TS ↔ SQL харьцуулалт.
 *
 *   pnpm db:test-event-bundles-dev      # зөвхөн .env.dev
 *
 * Сан бохирдуулахгүй: сценари бүр `begin … rollback` дотор (туг, үнэ, багц,
 * купон, оноо — бүгд транзакц дотор үүсч буцна). Бодит `place_order` →
 * `mark_order_paid` ажиллуулж, дүнг TS-ийн ижил функцуудаар (`bundlePrice`,
 * `withEventPcts`, `spreadBundleTotal`, `bundleEventSaving`) бодсонтой
 * харьцуулна. Туг нээлттэй ба хаалттай хоёр төлөвт.
 */
import type { Client } from "pg";
import { connectDb } from "./db";
import {
  bundleEventSaving,
  bundlePrice,
  discountForMl,
  spreadBundleTotal,
  withEventPcts,
} from "../src/features/collections/pricing";
import { orderSummaryRows, summarySource } from "../src/lib/orders/summary";

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

async function setFlag(c: Client, key: string, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ($1, $2)
       on conflict (key) do update set enabled = excluded.enabled`,
    [key, on],
  );
}

async function scenario(
  c: Client,
  name: string,
  flags: { bundles: boolean },
  body: () => Promise<void>,
) {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    // Dev-ийн жинхэнэ арга хэмжээ, гар хямдрал нөлөөлөхгүй.
    await c.query("update sale_events set is_active = false where is_active");
    await setFlag(c, "sale_events", true);
    await setFlag(c, "sale_event_bundles", flags.bundles);
    await body();
  } catch (e) {
    failed++;
    console.log("  ✖ алдаа", e);
  } finally {
    await c.query("rollback");
  }
}

/** Алдааны мессеж (амжилттай бол null) — savepoint дотор. */
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

const ML = 10;
const MEMBER_BASE = 25000; // 4 × 25,000 = 100,000₮ (§5-ын жишээ)

interface Fixture {
  user: string;
  collection: string;
  members: { product: string; variant: string }[];
  step: number;
}

/**
 * 4 бараа (10ml зарагдаж буй, үлдэгдэлтэй) → тэдгээрийн 10ml үндсэн үнийг
 * 25,000 болгож, гар хямдралыг арилгаад, суурь 5%-тай бэлэн багц үүсгэнэ.
 * Бүгд транзакц дотор.
 */
async function fixture(c: Client, basePct = 5): Promise<Fixture> {
  const users = await c.query<{ id: string }>(
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 1`,
  );
  const rows = await c.query<{ product_id: string; variant_id: string }>(`
    select distinct on (p.id) p.id as product_id, pv.id as variant_id
      from inventory i
      join products p on p.id = i.product_id
      join product_variants pv on pv.product_id = p.id and pv.ml = ${ML}
     where i.on_hand_ml - i.reserved_ml >= 100
       and p.is_active and p.status = 'active' and pv.is_active
       and variant_sellable(pv.*, p.gender, i.is_sold_out, i.on_hand_ml - i.reserved_ml)
     order by p.id
     limit 4`);
  if (!users.rows[0] || rows.rows.length < 4) {
    throw new Error(
      "Dev санд хэрэглэгч ба 10ml зарагдаж буй 4 бараа хэрэгтэй.",
    );
  }
  const members = rows.rows.map((r) => ({
    product: r.product_id,
    variant: r.variant_id,
  }));
  await c.query(
    `update product_variants
        set price = $1, sale_price = null, sale_starts_at = null,
            sale_ends_at = null, sale_id = null
      where id = any($2::uuid[])`,
    [MEMBER_BASE, members.map((m) => m.variant)],
  );
  const col = await c.query<{ id: string }>(
    `insert into collections (slug, type, name, discount_pct, is_active)
     values ('test-event-bundle-' || substr(md5(random()::text), 1, 8), 'base',
             'Тест багц', $1, true)
     returning id`,
    [basePct],
  );
  await c.query(
    `insert into collection_items (collection_id, product_id, sort_order)
     select $1, x, o from unnest($2::uuid[]) with ordinality t(x, o)`,
    [col.rows[0].id, members.map((m) => m.product)],
  );
  const st = await c.query<{ step: number }>(
    `select coalesce((select (value->>'roundTo')::int from settings
                       where key = 'collection'), 100) as step`,
  );
  return {
    user: users.rows[0].id,
    collection: col.rows[0].id,
    members,
    step: Number(st.rows[0].step),
  };
}

async function saveEvent(
  c: Client,
  f: Fixture,
  opts: {
    pcts: Record<string, number>;
    items?: { productId: string; pcts: Record<string, number> }[];
    isActive?: boolean;
    startsAt?: string;
    endsAt?: string;
    name?: string;
    collections?: boolean;
  },
) {
  const slug = "test-eb-" + Math.random().toString(36).slice(2, 8);
  const { rows } = await c.query<{ id: string }>(
    "select save_sale_event(null, $1::jsonb, $2::jsonb, null) as id",
    [
      JSON.stringify({
        slug,
        name: opts.name ?? "Black Friday",
        startsAt: opts.startsAt ?? new Date(Date.now() - 86400e3).toISOString(),
        endsAt: opts.endsAt ?? new Date(Date.now() + 86400e3).toISOString(),
        isActive: opts.isActive ?? true,
        showCountdown: true,
        ...(opts.collections === false
          ? {}
          : { collections: [{ collectionId: f.collection, pcts: opts.pcts }] }),
      }),
      JSON.stringify(opts.items ?? []),
    ],
  );
  return rows[0].id;
}

/** TS тал: `priceCollectionLines`-ийн ижил дүрэм. */
function tsBundle(f: Fixture, basePct: number, eventPct: number | null) {
  const units = f.members.map(() => MEMBER_BASE);
  const memberSum = units.reduce((s, u) => s + u, 0);
  const base = discountForMl(ML, basePct, {});
  const pct =
    eventPct == null
      ? base
      : discountForMl(
          ML,
          basePct,
          withEventPcts(basePct, {}, { [ML]: eventPct }),
        );
  const total = bundlePrice(memberSum, pct, f.step);
  return {
    memberSum,
    total,
    units: spreadBundleTotal(units, total),
    eventSaving:
      eventPct == null ? 0 : bundleEventSaving(memberSum, base, total, f.step),
  };
}

interface OrderRow {
  id: string;
  subtotal: number;
  gross_subtotal: number;
  sale_discount: number;
  sale_breakdown: { label: string; amount: number }[];
  discount: number;
  loyalty_used: number;
  shipping_fee: number;
  total: number;
  coupon_code: string | null;
  coupon_pct: number | null;
}

async function placeOrder(
  c: Client,
  f: Fixture,
  bundle: { total: number; units: number[] },
  opts: {
    coupon?: string;
    loyalty?: number;
    shipping?: number;
    extraLines?: unknown[];
    expected?: Record<string, number>;
  } = {},
): Promise<OrderRow> {
  const { rows } = await c.query<{ r: { order_id: string } }>(
    "select place_order($1::jsonb, $2::jsonb) as r",
    [
      JSON.stringify({
        user_id: f.user,
        contact_name: "Event bundle test",
        contact_phone: "99000000",
        ship_detail: "test",
        shipping_fee: opts.shipping ?? 0,
        coupon_code: opts.coupon ?? null,
        loyalty_used: opts.loyalty ?? 0,
        ...(opts.expected ? { expected: opts.expected } : {}),
      }),
      JSON.stringify([
        ...f.members.map((m, i) => ({
          product_id: m.product,
          variant_id: m.variant,
          ml: ML,
          qty: 1,
          kind: "bundle",
          unit_price: bundle.units[i],
          collection_id: f.collection,
          collection_name: "Тест багц",
        })),
        ...(opts.extraLines ?? []),
      ]),
    ],
  );
  const o = await c.query<OrderRow>(
    `select o.id, o.subtotal, o.gross_subtotal, o.sale_discount, o.sale_breakdown,
            o.discount, o.loyalty_used, o.shipping_fee, o.total, o.coupon_code,
            o.coupon_pct
       from orders o where o.id = $1`,
    [rows[0].r.order_id],
  );
  return o.rows[0];
}

function printBreakdown(o: OrderRow) {
  const rows = orderSummaryRows(summarySource(o));
  for (const r of rows) console.log(`      ${r.label.padEnd(22)} ${r.value}`);
  console.log(
    `      ${"Нийт төлөх (QPay)".padEnd(22)} ${o.total.toLocaleString("en-US")}₮`,
  );
}

/** §5: купон 10%, V point 5,000, хүргэлт 6,000; mark_order_paid-ийн оноо. */
async function fullOrder(c: Client, f: Fixture, eventPct: number | null) {
  const code = "EB" + Math.random().toString(36).slice(2, 8).toUpperCase();
  await c.query(
    `insert into coupons (code, user_id, type, value, min_subtotal, max_uses, is_active)
     values ($1, $2, 'percent', 10, 0, 1, true)`,
    [code, f.user],
  );
  await c.query(
    "update profiles set loyalty_points = greatest(loyalty_points, 100000) where id = $1",
    [f.user],
  );
  const ts = tsBundle(f, 5, eventPct);
  // Checkout хуудасны тооцоо (client `expected`): купон subtotal-аас floor.
  const subtotal = ts.total;
  const discount = Math.floor((subtotal * 10) / 100);
  const loyalty = 5000;
  const shipping = 6000;
  const total = subtotal - discount - loyalty + shipping;
  const o = await placeOrder(c, f, ts, {
    coupon: code,
    loyalty,
    shipping,
    expected: {
      subtotal,
      discount,
      loyalty_used: loyalty,
      shipping_fee: shipping,
      total,
    },
  });
  // mark_order_paid → оноо (суурь = orders.total).
  await c.query("select mark_order_paid($1, null, 'mock')", [o.id]);
  const earned = await c.query<{ delta: number }>(
    `select coalesce(sum(delta), 0)::int as delta from loyalty_ledger
      where order_id = $1 and reason = 'earn'`,
    [o.id],
  );
  const tiers = await c.query<{
    on: boolean;
    rate: number;
    per: number;
    pts: number;
  }>(
    `select feature_enabled('user_tiers') as on,
            tier_rate_for_spend(greatest(user_lifetime_spend($1) - $2, 0)) as rate,
            coalesce((select (value->>'earnPer')::int from settings where key = 'loyalty'), 100) as per,
            coalesce((select (value->>'earnPoints')::int from settings where key = 'loyalty'), 1) as pts`,
    [f.user, Math.max(o.subtotal - o.discount, 0)],
  );
  const t = tiers.rows[0];
  const expectedEarn = t.on
    ? Math.floor((o.total * Number(t.rate)) / 100)
    : t.per > 0
      ? Math.floor(o.total / t.per) * t.pts
      : 0;
  return {
    ts,
    o,
    expected: { subtotal, discount, loyalty, shipping, total },
    earned: earned.rows[0].delta,
    expectedEarn,
  };
}

/** Ижил гишүүдтэй нэмэлт бэлэн багц (транзакц дотор). */
async function extraCollection(
  c: Client,
  f: Fixture,
  name: string,
  active = true,
) {
  const col = await c.query<{ id: string }>(
    `insert into collections (slug, type, name, discount_pct, is_active)
     values ('test-event-bundle-' || substr(md5(random()::text), 1, 8), 'base', $1, 5, $2)
     returning id`,
    [name, active],
  );
  await c.query(
    `insert into collection_items (collection_id, product_id, sort_order)
     select $1, x, o from unnest($2::uuid[]) with ordinality t(x, o)`,
    [col.rows[0].id, f.members.map((m) => m.product)],
  );
  return col.rows[0].id;
}

/** `save_sale_event`-ийг дурын p_data-тай (id-тай засвар). */
function saveRaw(
  c: Client,
  id: string | null,
  data: Record<string, unknown>,
  items: unknown[] = [],
) {
  return errorOf(c, "select save_sale_event($1, $2::jsonb, $3::jsonb, null)", [
    id,
    JSON.stringify({
      slug: "test-eb-merge",
      name: "Black Friday",
      startsAt: new Date(Date.now() - 86400e3).toISOString(),
      endsAt: new Date(Date.now() + 86400e3).toISOString(),
      isActive: true,
      showCountdown: true,
      ...data,
    }),
    JSON.stringify(items),
  ]);
}

async function eventCollections(c: Client, eventId: string) {
  const r = await c.query<{ collection_id: string }>(
    "select collection_id from sale_event_collections where event_id = $1",
    [eventId],
  );
  return new Set(r.rows.map((x) => x.collection_id));
}

async function main() {
  const c = await connectDb(url!);

  await scenario(
    c,
    "1. collection_bundle_price ↔ bundlePrice (TS) — 40k жишээ",
    { bundles: true },
    async () => {
      const sums: number[] = [];
      const pcts: number[] = [];
      const steps: number[] = [];
      for (let i = 0; i < 20000; i++) {
        sums.push(Math.floor(Math.random() * 400000));
        pcts.push(
          [5, 7.5, 10, 12.25, 15, 33.33, 0, 50][i % 8] +
            (i % 3 === 0 ? Math.floor(Math.random() * 40) : 0),
        );
        steps.push([100, 1, 50, 10][i % 4]);
      }
      for (let s = 0; s <= 200000; s += 50) {
        for (const p of [5, 10, 15, 20, 25]) {
          sums.push(s);
          pcts.push(p);
          steps.push(100);
        }
      }
      const r = await c.query<{ v: number }>(
        `select collection_bundle_price(s, p, st) v
         from unnest($1::bigint[], $2::numeric[], $3::int[]) with ordinality t(s, p, st, o)
        order by o`,
        [sums, pcts, steps],
      );
      const bad = r.rows.filter(
        (row, i) => bundlePrice(sums[i], pcts[i], steps[i]) !== row.v,
      );
      check(
        `${sums.length} жишээ бүгд ижил`,
        bad.length === 0,
        bad.slice(0, 3),
      );
    },
  );

  await scenario(
    c,
    "2. §5 туг НЭЭЛТТЭЙ: 100,000₮, суурь 5%, Black Friday 10%, купон 10%, V point 5,000, хүргэлт 6,000",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      await saveEvent(c, f, { pcts: { [ML]: 10 } });
      const live = await c.query(
        "select * from live_event_collection_discounts() where collection_id = $1",
        [f.collection],
      );
      check(
        "live_event_collection_discounts: 10ml = 10%",
        live.rows.length === 1 && live.rows[0].pct === 10,
        live.rows,
      );
      const { ts, o, expected, earned, expectedEarn } = await fullOrder(
        c,
        f,
        10,
      );
      check("TS багц = 90,000", ts.total === 90000, ts);
      check(
        "SQL subtotal = TS (90,000) — TOTAL_CHANGED гараагүй",
        o.subtotal === expected.subtotal,
        o,
      );
      check("купон 9,000", o.discount === 9000, o.discount);
      check(
        "total = 82,000",
        o.total === 82000 && o.total === expected.total,
        o.total,
      );
      check(
        "gross_subtotal = 90,000 (Багцын хямдрал мөргүй, 0201)",
        o.gross_subtotal === 90000,
        o.gross_subtotal,
      );
      check("sale_discount = 10,000", o.sale_discount === 10000, o.sale_discount);
      check(
        "sale_breakdown = [Black Friday 10,000] = TS bundleEventSaving",
        JSON.stringify(o.sale_breakdown) ===
          JSON.stringify([{ label: "Black Friday", amount: ts.eventSaving }]) &&
          ts.eventSaving === 10000,
        o.sale_breakdown,
      );
      check(
        `оноо суурь = total (${earned} = ${expectedEarn})`,
        earned === expectedEarn,
        { earned, expectedEarn },
      );
      printBreakdown(o);
    },
  );

  await scenario(
    c,
    "3. §5 туг ХААЛТТАЙ: өмнөхтэй яг ижил (95,000 → 86,500), санд юу ч бичигдэхгүй",
    { bundles: false },
    async () => {
      const f = await fixture(c);
      const err = await errorOf(
        c,
        "select save_sale_event(null, $1::jsonb, '[]'::jsonb, null)",
        [
          JSON.stringify({
            slug: "test-eb-off",
            name: "Black Friday",
            startsAt: new Date(Date.now() - 86400e3).toISOString(),
            endsAt: new Date(Date.now() + 86400e3).toISOString(),
            isActive: true,
            showCountdown: true,
            collections: [{ collectionId: f.collection, pcts: { [ML]: 10 } }],
          }),
        ],
      );
      check(
        "save_sale_event + collections → FEATURE_DISABLED",
        /FEATURE_DISABLED/.test(err?.message ?? ""),
        err?.message,
      );
      const n = await c.query<{ n: number }>(
        "select count(*)::int as n from sale_event_collections where collection_id = $1",
        [f.collection],
      );
      check("sale_event_collections-д мөр алга", n.rows[0].n === 0, n.rows[0]);
      // Туг нээлттэй үед бичигдсэн event-ийг хаалттай үед уншихгүй.
      await setFlag(c, "sale_event_bundles", true);
      await saveEvent(c, f, { pcts: { [ML]: 10 } });
      await setFlag(c, "sale_event_bundles", false);
      const live = await c.query(
        "select * from live_event_collection_discounts()",
      );
      check(
        "live_event_collection_discounts хоосон",
        live.rows.length === 0,
        live.rows,
      );
      const { ts, o, expected, earned, expectedEarn } = await fullOrder(
        c,
        f,
        null,
      );
      check("TS багц = 95,000", ts.total === 95000, ts);
      check(
        "subtotal 95,000 / купон 9,500 / total 86,500",
        o.subtotal === 95000 &&
          o.discount === 9500 &&
          o.total === 86500 &&
          o.total === expected.total,
        o,
      );
      check(
        "gross_subtotal 100,000 / sale_discount 0 / sale_breakdown []",
        o.gross_subtotal === 100000 &&
          o.sale_discount === 0 &&
          o.sale_breakdown.length === 0,
        o,
      );
      check(
        `оноо суурь = total (${earned} = ${expectedEarn})`,
        earned === expectedEarn,
        { earned, expectedEarn },
      );
      printBreakdown(o);
    },
  );

  await scenario(
    c,
    "4. суурь 15% / event 10%: хадгалахгүй; ажиллах үед greatest → 15% хэвээр",
    { bundles: true },
    async () => {
      const f = await fixture(c, 15);
      const low = await errorOf(
        c,
        "select save_sale_event(null, $1::jsonb, '[]'::jsonb, null)",
        [
          JSON.stringify({
            slug: "test-eb-low",
            name: "Black Friday",
            startsAt: new Date(Date.now() - 86400e3).toISOString(),
            endsAt: new Date(Date.now() + 86400e3).toISOString(),
            isActive: true,
            showCountdown: true,
            collections: [{ collectionId: f.collection, pcts: { [ML]: 10 } }],
          }),
        ],
      );
      check(
        "BUNDLE_PCT_LOW (detail-д basePct 15)",
        /BUNDLE_PCT_LOW/.test(low?.message ?? "") &&
          /"basePct": ?15/.test(low?.detail ?? ""),
        { m: low?.message, d: low?.detail },
      );
      // Админ дараа нь суурийг өсгөсөн нөхцөл: event 10% шууд оруулна.
      const ev = await saveEvent(c, f, { pcts: { [ML]: 20 } });
      await c.query(
        "update sale_event_collection_discounts set pct = 10 where event_id = $1",
        [ev],
      );
      const ts = tsBundle(f, 15, 10);
      check(
        "TS: 85,000 (15%), event хэмнэлт 0",
        ts.total === 85000 && ts.eventSaving === 0,
        ts,
      );
      const o = await placeOrder(c, f, ts);
      check(
        "SQL: gross 100,000, sale_breakdown []",
        o.gross_subtotal === 100000 &&
          o.sale_breakdown.length === 0 &&
          o.subtotal === 85000,
        o,
      );
      printBreakdown(o);
    },
  );

  await scenario(
    c,
    "5. гишүүн үнэртэн мөн event-д (20%) — багц давхар хямдрахгүй, ижил нэрийн мөр нийлнэ",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      const m0 = f.members[0];
      await saveEvent(c, f, {
        pcts: { [ML]: 10 },
        items: [{ productId: m0.product, pcts: { [ML]: 20 } }],
      });
      const vp = await c.query<{ p: number }>(
        "select variant_price(pv.*) as p from product_variants pv where id = $1",
        [m0.variant],
      );
      check(
        "гишүүний дан үнэ 20,000 (event 20%)",
        vp.rows[0].p === 20000,
        vp.rows[0],
      );
      const ts = tsBundle(f, 5, 10);
      check("багц үндсэн үнээс: 90,000 (72,000 биш)", ts.total === 90000, ts);
      // Багц + тэр гишүүн дангаараа 1 ширхэг.
      const o = await placeOrder(c, f, ts, {
        extraLines: [
          {
            product_id: m0.product,
            variant_id: m0.variant,
            ml: ML,
            qty: 1,
            kind: "perfume",
          },
        ],
      });
      check("subtotal 110,000", o.subtotal === 110000, o.subtotal);
      check(
        "sale_breakdown = [Black Friday 15,000] (дан 5,000 + багц 10,000)",
        JSON.stringify(o.sale_breakdown) ===
          JSON.stringify([{ label: "Black Friday", amount: 15000 }]),
        o.sale_breakdown,
      );
      check(
        "gross 110,000 → Нийт үндсэн үнэ 125,000",
        o.gross_subtotal === 110000 &&
          o.gross_subtotal + o.sale_discount === 125000,
        o,
      );
      printBreakdown(o);
    },
  );

  await scenario(
    c,
    "6. 16.5 / 16.3 — хувьгүй багц, давхцал, ноорог",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      const none = await errorOf(
        c,
        "select save_sale_event(null, $1::jsonb, '[]'::jsonb, null)",
        [
          JSON.stringify({
            slug: "test-eb-none",
            name: "X",
            startsAt: new Date(Date.now() + 86400e3).toISOString(),
            endsAt: new Date(Date.now() + 3 * 86400e3).toISOString(),
            isActive: false,
            showCountdown: true,
            collections: [
              { collectionId: f.collection, pcts: { "2": "", "5": null } },
            ],
          }),
        ],
      );
      check(
        "4 хэмжээ бүгд хувьгүй → BUNDLE_NO_PCT",
        /BUNDLE_NO_PCT/.test(none?.message ?? ""),
        none?.message,
      );
      await saveEvent(c, f, { pcts: { [ML]: 10 }, name: "Нэгдүгээр" });
      // Ноорог хугацаа давхцсан ч түгжихгүй (барааны дүрэмтэй ижил).
      const draft = await errorOf(
        c,
        "select save_sale_event(null, $1::jsonb, '[]'::jsonb, null)",
        [
          JSON.stringify({
            slug: "test-eb-draft",
            name: "Ноорог",
            startsAt: new Date(Date.now() - 86400e3).toISOString(),
            endsAt: new Date(Date.now() + 86400e3).toISOString(),
            isActive: false,
            showCountdown: true,
            collections: [{ collectionId: f.collection, pcts: { [ML]: 12 } }],
          }),
        ],
      );
      check("ноорог → амжилттай", draft === null, draft?.message);
      const overlap = await errorOf(
        c,
        "select save_sale_event(null, $1::jsonb, '[]'::jsonb, null)",
        [
          JSON.stringify({
            slug: "test-eb-ov",
            name: "Хоёрдугаар",
            startsAt: new Date(Date.now() - 3600e3).toISOString(),
            endsAt: new Date(Date.now() + 2 * 86400e3).toISOString(),
            isActive: true,
            showCountdown: true,
            collections: [{ collectionId: f.collection, pcts: { [ML]: 12 } }],
          }),
        ],
      );
      check(
        "нийтэлсэн давхцал → EVENT_BUNDLE_OVERLAP («Нэгдүгээр» detail-д)",
        /EVENT_BUNDLE_OVERLAP/.test(overlap?.message ?? "") &&
          /Нэгдүгээр/.test(overlap?.detail ?? ""),
        { m: overlap?.message, d: overlap?.detail },
      );
    },
  );

  await scenario(
    c,
    "7. event дууссан / товлосон — хувь буцна, anon-д ил гарахгүй",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      await saveEvent(c, f, {
        pcts: { [ML]: 10 },
        startsAt: new Date(Date.now() - 3 * 86400e3).toISOString(),
        endsAt: new Date(Date.now() - 86400e3).toISOString(),
        name: "Дууссан",
      });
      await saveEvent(c, f, {
        pcts: { [ML]: 30 },
        startsAt: new Date(Date.now() + 86400e3).toISOString(),
        endsAt: new Date(Date.now() + 3 * 86400e3).toISOString(),
        name: "Товлосон",
      });
      await saveEvent(c, f, {
        pcts: { [ML]: 40 },
        isActive: false,
        name: "Ноорог",
      });
      await c.query("set local role anon");
      const live = await c.query(
        "select * from live_event_collection_discounts()",
      );
      check(
        "anon: live функц хоосон (дууссан/товлосон/ноорог гарахгүй)",
        live.rows.length === 0,
        live.rows,
      );
      const direct = await errorOf(
        c,
        "select * from sale_event_collection_discounts",
      );
      const rows = direct
        ? []
        : (await c.query("select * from sale_event_collection_discounts")).rows;
      check(
        "anon: хүснэгтийг шууд уншихад мөр алга (RLS)",
        rows.length === 0,
        rows,
      );
      await c.query("reset role");
      const ts = tsBundle(f, 5, null);
      const o = await placeOrder(c, f, ts);
      check(
        "захиалга суурь хувиар (95,000), задаргаагүй",
        o.subtotal === 95000 &&
          o.sale_breakdown.length === 0 &&
          o.gross_subtotal === 100000,
        o,
      );
    },
  );

  await scenario(
    c,
    "8. 0191: дууссан багцтай event-д өөр багц нэмж хадгалах → дууссан багц ҮЛДЭНЭ",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      const ln = f.collection; // «LADIES NIGHT» — event-д орсны дараа дуусна
      const office = await extraCollection(c, f, "OFFICE");
      const ev = await saveEvent(c, f, { pcts: { [ML]: 10 } });
      // Гишүүн дууслаа → багц бүх хэмжээгээр зарагдахгүй.
      await c.query(
        "update inventory set is_sold_out = true where product_id = $1",
        [f.members[0].product],
      );
      const sell = await c.query<{ ln: boolean; of: boolean }>(
        "select collection_sellable($1) as ln, collection_sellable($2) as of",
        [ln, office],
      );
      check(
        "collection_sellable: дууссан = false",
        sell.rows[0].ln === false && sell.rows[0].of === false,
        sell.rows[0],
      );
      await c.query(
        "update inventory set is_sold_out = false where product_id = $1",
        [f.members[0].product],
      );
      // OFFICE-ийг зарагдаж буй болгож, LN-ийг дан дууссан болгохын тулд LN-д нэмэлт гишүүн.
      const extra = await c.query<{ id: string }>(
        `
      select p.id from products p join inventory i on i.product_id = p.id
       where p.is_active and i.is_sold_out and not (p.id = any($1::uuid[])) limit 1`,
        [f.members.map((m) => m.product)],
      );
      if (!extra.rows[0]) throw new Error("dev санд дууссан бараа хэрэгтэй");
      await c.query(
        "insert into collection_items (collection_id, product_id, sort_order) values ($1, $2, 9)",
        [ln, extra.rows[0].id],
      );
      const s2 = await c.query<{ ln: boolean; of: boolean }>(
        "select collection_sellable($1) as ln, collection_sellable($2) as of",
        [ln, office],
      );
      check(
        "LN дууссан, OFFICE зарагдаж байна",
        s2.rows[0].ln === false && s2.rows[0].of === true,
        s2.rows[0],
      );

      // Хуучин snapshot (LN-гүй) -оос OFFICE нэмж хадгалах — merge горим.
      const err = await saveRaw(c, ev, {
        collections: [{ collectionId: office, pcts: { [ML]: 12 } }],
        removedCollectionIds: [],
        removedProductIds: [],
      });
      check("хадгалагдлаа", err === null, err?.message);
      const after = await eventCollections(c, ev);
      check(
        "LN үлдсэн + OFFICE нэмэгдсэн",
        after.has(ln) && after.has(office),
        [...after],
      );
      // LN-ийг илгээж (дууссан, аль хэдийн гишүүн) хадгалах → татгалзахгүй.
      const keep = await saveRaw(c, ev, {
        collections: [
          { collectionId: ln, pcts: { [ML]: 10 } },
          { collectionId: office, pcts: { [ML]: 12 } },
        ],
        removedCollectionIds: [],
        removedProductIds: [],
      });
      check(
        "дууссан хуучин гишүүнийг илгээхэд BUNDLE_UNAVAILABLE гарахгүй",
        keep === null,
        keep?.message,
      );
      // Админ өөрөө хасвал л устана.
      const rm = await saveRaw(c, ev, {
        collections: [{ collectionId: office, pcts: { [ML]: 12 } }],
        removedCollectionIds: [ln],
        removedProductIds: [],
      });
      const final = await eventCollections(c, ev);
      check(
        "removedCollectionIds-аар л хасагдана",
        rm === null && !final.has(ln) && final.has(office),
        [...final],
      );
    },
  );

  await scenario(
    c,
    "9. 0191: дууссан / идэвхгүй багцыг ШИНЭЭР нэмэх → BUNDLE_UNAVAILABLE",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      const inactive = await extraCollection(c, f, "Идэвхгүй багц", false);
      await c.query(
        "update inventory set is_sold_out = true where product_id = $1",
        [f.members[0].product],
      );
      const sold = await saveRaw(c, null, {
        slug: "test-eb-sold",
        collections: [{ collectionId: f.collection, pcts: { [ML]: 10 } }],
      });
      check(
        "дууссан → BUNDLE_UNAVAILABLE (sold_out)",
        /BUNDLE_UNAVAILABLE/.test(sold?.message ?? "") &&
          /sold_out/.test(sold?.detail ?? ""),
        { m: sold?.message, d: sold?.detail },
      );
      await c.query(
        "update inventory set is_sold_out = false where product_id = $1",
        [f.members[0].product],
      );
      const ina = await saveRaw(c, null, {
        slug: "test-eb-inactive",
        collections: [{ collectionId: inactive, pcts: { [ML]: 10 } }],
      });
      check(
        "идэвхгүй → BUNDLE_UNAVAILABLE (inactive)",
        /BUNDLE_UNAVAILABLE/.test(ina?.message ?? "") &&
          /inactive/.test(ina?.detail ?? ""),
        { m: ina?.message, d: ina?.detail },
      );
      const n = await c.query<{ n: number }>(
        "select count(*)::int n from sale_events where slug in ('test-eb-sold','test-eb-inactive')",
      );
      check("санд юу ч үлдээгүй", n.rows[0].n === 0, n.rows[0]);
    },
  );

  await scenario(
    c,
    "10. 0191: бараа — хуучин snapshot-оос хадгалахад хараагүй бараа устахгүй",
    { bundles: true },
    async () => {
      const f = await fixture(c);
      const [a, b] = f.members;
      const ev = await saveEvent(c, f, {
        pcts: { [ML]: 10 },
        collections: false,
        items: [{ productId: a.product, pcts: { [ML]: 20 } }],
      });
      // Өөр tab-аас b нэмэгдсэн, энэ client a-г л мэднэ.
      await saveRaw(c, ev, { removedProductIds: [] }, [
        { productId: a.product, pcts: { [ML]: 20 } },
        { productId: b.product, pcts: { [ML]: 15 } },
      ]);
      await saveRaw(c, ev, { removedProductIds: [] }, [
        { productId: a.product, pcts: { [ML]: 25 } },
      ]);
      const rows = await c.query<{ product_id: string; pct: number }>(
        "select product_id, pct from sale_event_discounts where event_id = $1 and ml = $2",
        [ev, ML],
      );
      const by = Object.fromEntries(
        rows.rows.map((r) => [r.product_id, r.pct]),
      );
      check(
        "b үлдсэн (15%), a шинэчлэгдсэн (25%)",
        by[b.product] === 15 && by[a.product] === 25,
        by,
      );
      // Хуучин клиент (түлхүүргүй) — өмнөх бүрэн солих зан төлөв хэвээр.
      await saveRaw(c, ev, {}, [{ productId: a.product, pcts: { [ML]: 25 } }]);
      const old = await c.query(
        "select 1 from sale_event_products where event_id = $1 and product_id = $2",
        [ev, b.product],
      );
      check(
        "түлхүүргүй бол бүрэн солино (хуучин клиент)",
        old.rows.length === 0,
        old.rows,
      );
    },
  );

  await c.end();
  console.log(failed ? `\n✖ ${failed} шалгалт унав` : "\n✅ Бүгд амжилттай");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
