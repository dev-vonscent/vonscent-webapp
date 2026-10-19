/**
 * Нэмэлт бараа ба савны тоон нөөцийн integration тест (extras-shop-plan §14) —
 * бодит Postgres дээр.
 *
 *   pnpm db:test-extras-dev      # зөвхөн .env.dev
 *
 * Сценари бүр `begin … rollback` дотор — тугийг ч transaction дотор асаана,
 * dev сангийн тохиргоо өөрчлөгдөхгүй. Зэрэг ажиллагааны сценари л commit
 * хийх ёстой бөгөөд тэд `finally` дотор өөрсдийн мөрийг цэвэрлэнэ.
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

let failed = 0;
const failures: string[] = [];
let current = "";
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    failures.push(`${current}: ${name}`);
    console.log(
      `  ✖ ${name}`,
      detail === undefined ? "" : JSON.stringify(detail),
    );
  }
}

async function scenario(c: Client, name: string, fn: () => Promise<void>) {
  current = name;
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    await fn();
  } catch (e) {
    failed++;
    failures.push(`${name}: алдаа`);
    console.log("  ✖ алдаа:", (e as Error).message);
  } finally {
    await c.query("rollback");
  }
}

/** Savepoint дотор ажиллуулж алдааны мессежийг буцаана (амжилттай бол null). */
async function errorOf(c: Client, sql: string, params: unknown[] = []) {
  await c.query("savepoint t");
  try {
    await c.query(sql, params);
    await c.query("release savepoint t");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint t");
    return (e as Error).message;
  }
}

async function one<T>(c: Client, sql: string, params: unknown[] = []) {
  const { rows } = await c.query(sql, params);
  return rows[0] as T;
}

async function flag(c: Client, key: string, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ($1, $2)
       on conflict (key) do update set enabled = excluded.enabled`,
    [key, on],
  );
}

async function categoryId(c: Client, slug: string) {
  return (
    await one<{ id: string }>(
      c,
      "select id from extra_categories where slug = $1",
      [slug],
    )
  ).id;
}

async function save(c: Client, payload: object, by: string | null = null) {
  return (
    await one<{ r: { id: string } }>(
      c,
      "select extras_save($1::jsonb, $2) as r",
      [JSON.stringify(payload), by],
    )
  ).r;
}

async function staffId(c: Client) {
  return (
    (
      await one<{ id: string }>(
        c,
        "select id from profiles where role in ('super_admin','operator') order by created_at limit 1",
      )
    )?.id ?? null
  );
}

/** Декантын нөөцтэй (≥ 60ml боломжит) үнэртэн. */
async function perfumeWithStock(c: Client) {
  return one<{ product_id: string; on_hand_ml: number; reserved_ml: number }>(
    c,
    `select i.product_id, i.on_hand_ml, i.reserved_ml from inventory i
       join products p on p.id = i.product_id
      where i.on_hand_ml - i.reserved_ml >= 60
      order by i.product_id limit 1`,
  );
}

// ── Захиалгын туслах (PR6) ───────────────────────────────────────────

interface Perfume {
  product_id: string;
  variant_id: string;
  ml: number;
  price: number;
  gender: string;
}

/** Декантын нөөцтэй, идэвхтэй 10ml хэмжээтэй үнэртэн. */
async function perfume10(c: Client, offset = 0): Promise<Perfume> {
  return one<Perfume>(
    c,
    `select i.product_id, pv.id as variant_id, pv.ml, variant_price(pv.*) as price,
            p.gender::text as gender
       from inventory i
       join products p on p.id = i.product_id and p.status = 'active'
       join product_variants pv on pv.product_id = p.id and pv.ml = 10 and pv.is_active
      where i.on_hand_ml - i.reserved_ml >= 200 and variant_price(pv.*) > 0
      order by i.product_id offset $1 limit 1`,
    [offset],
  );
}

async function customerId(c: Client) {
  return (
    await one<{ id: string }>(
      c,
      `select u.id from auth.users u join profiles p on p.id = u.id
        where p.role = 'customer' order by u.created_at limit 1`,
    )
  ).id;
}

/** Нийтэлсэн энгийн нэмэлт бараа (тоотой). */
async function localExtra(c: Client, slug: string, price: number, qty: number) {
  await flag(c, "extras_shop", true);
  const r = await save(c, {
    category_id: await categoryId(c, "gift-box"),
    slug,
    name: `Test ${slug}`,
    variants: [{ label: "Хар", price, initial_qty: qty }],
  });
  await c.query("select extras_set_status($1, 'published', null)", [r.id]);
  const v = await one<{ id: string }>(
    c,
    "select id from extra_variants where extra_id = $1",
    [r.id],
  );
  return { extraId: r.id, variantId: v.id, price };
}

/** Нийтэлсэн үлдэгдэлтэй шил. */
async function leftoverExtra(
  c: Client,
  slug: string,
  productId: string,
  ml = 10,
) {
  await flag(c, "extras_shop", true);
  const r = await save(c, {
    category_id: await categoryId(c, "leftover"),
    slug,
    name: `Шил ${slug}`,
    leftover: { product_id: productId, remaining_ml: ml, full_ml: 100 },
    variants: [{ price: 30000 }],
  });
  await c.query("select extras_set_status($1, 'published', null)", [r.id]);
  const v = await one<{ id: string }>(
    c,
    "select id from extra_variants where extra_id = $1",
    [r.id],
  );
  return { extraId: r.id, variantId: v.id, price: 30000 };
}

interface Line {
  kind: "perfume" | "extra";
  product_id?: string;
  variant_id?: string;
  ml?: number;
  extra_variant_id?: string;
  expected_unit_price?: number;
  qty: number;
}

const perfumeLine = (p: Perfume, qty = 1): Line => ({
  kind: "perfume",
  product_id: p.product_id,
  variant_id: p.variant_id,
  ml: p.ml,
  qty,
});
const extraLine = (
  e: { variantId: string; price: number },
  qty = 1,
  price = e.price,
): Line => ({
  kind: "extra",
  extra_variant_id: e.variantId,
  expected_unit_price: price,
  qty,
});

interface Summary {
  order_id: string;
  order_no: string;
  subtotal: number;
  discount: number;
  loyalty_used: number;
  shipping_fee: number;
  total: number;
  lines: { id: string; line_kind: string; qty: number; is_gift: boolean }[];
  omitted_gifts: { product_id: string; reason: string }[];
}

async function order(
  c: Client,
  lines: Line[],
  opts: {
    user?: string | null;
    expected?: object;
    gifts?: string[];
    coupon?: string;
    loyalty?: number;
    shipping?: number;
  } = {},
): Promise<Summary> {
  const { rows } = await c.query<{ r: Summary }>(
    "select place_order($1::jsonb, $2::jsonb) as r",
    [
      JSON.stringify({
        user_id: opts.user ?? null,
        contact_name: "Extras test",
        contact_phone: "99000000",
        ship_detail: "test",
        shipping_fee: opts.shipping ?? 0,
        coupon_code: opts.coupon ?? null,
        loyalty_used: opts.loyalty ?? 0,
        ...(opts.expected ? { expected: opts.expected } : {}),
        ...(opts.gifts ? { gift_product_ids: opts.gifts } : {}),
      }),
      JSON.stringify(lines),
    ],
  );
  return rows[0].r;
}

async function orderError(c: Client, lines: Line[], opts = {}) {
  await c.query("savepoint o");
  try {
    await order(c, lines, opts);
    await c.query("release savepoint o");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint o");
    return (e as Error).message;
  }
}

async function status(c: Client, id: string, s: string) {
  await c.query(
    "select update_order_status($1, $2::order_status_t, 'test', null)",
    [id, s],
  );
}

async function variantStock(c: Client, id: string) {
  return one<{ on_hand_qty: number; reserved_qty: number }>(
    c,
    "select on_hand_qty, reserved_qty from extra_variants where id = $1",
    [id],
  );
}

/**
 * Reconciliation (§14): нөөцийн тоо нь захиалгын мөрийн төлөвтэй, хөдөлгөөний
 * нийлбэртэй таарна. Сценари бүрийн төгсгөлд (rollback-аас өмнө).
 */
async function reconcile(c: Client) {
  const r = await one<Record<string, number>>(
    c,
    `select
       (select count(*) from orders o
         where o.subtotal <> coalesce((select sum(line_total) from order_items i where i.order_id = o.id), 0))::int as bad_subtotal,
       (select count(*) from orders o
         where o.total <> o.subtotal + o.shipping_fee - o.discount - o.loyalty_used)::int as bad_total,
       (select count(*) from extra_variants v
         where v.inventory_mode = 'local_quantity'
           and v.reserved_qty <> coalesce((select sum(qty) from order_items i
                where i.extra_variant_id = v.id and i.extra_state = 'reserved'), 0))::int as bad_local,
       (select count(*) from vials v
         where v.reserved <> coalesce((select sum(qty) from order_items i
                where i.vial_id = v.id and i.vial_state = 'reserved'), 0))::int as bad_vial,
       (select count(*) from extra_variants v
         where v.on_hand_qty <> coalesce((select sum(delta_on_hand) from extra_movements m where m.extra_variant_id = v.id), 0)
            or v.reserved_qty <> coalesce((select sum(delta_reserved) from extra_movements m where m.extra_variant_id = v.id), 0))::int as bad_extra_moves,
       (select count(*) from vials v
         where coalesce(v.on_hand, 0) <> coalesce((select sum(delta_on_hand) from vial_movements m where m.vial_id = v.id), 0)
            or v.reserved <> coalesce((select sum(delta_reserved) from vial_movements m where m.vial_id = v.id), 0))::int as bad_vial_moves`,
  );
  const bad = Object.entries(r).filter(([, n]) => n !== 0);
  check("reconciliation 0 зөрүү", bad.length === 0, Object.fromEntries(bad));
}

async function main() {
  const a = await connectDb(url!);
  const by = await staffId(a);

  // ── Schema (§14 №21, №22) ───────────────────────────────────────────
  await scenario(a, "Горим зөрсөн insert → constraint (№21)", async () => {
    const box = await categoryId(a, "gift-box");
    const err1 = await errorOf(
      a,
      `insert into extra_products (category_id, inventory_mode, slug, name)
       values ($1, 'leftover_liquid', 't-x', 'x')`,
      [box],
    );
    // Trigger горимыг ангиллаас хуулдаг тул leftover-ийн шаардлага (product_id)
    // биш — ангиллын горим ялна. Хувилбарын талд шууд зөрүүлж шалгана.
    check("бараа ангиллын горимыг авна (зөрөх боломжгүй)", err1 === null, err1);
    const p = await one<{ id: string; inventory_mode: string }>(
      a,
      "select id, inventory_mode from extra_products where slug = 't-x'",
    );
    check("горим = local_quantity", p.inventory_mode === "local_quantity", p);
    const err2 = await errorOf(
      a,
      `insert into extra_variants (extra_id, label, price, vial_id)
       values ($1, 'x', 1, (select id from vials limit 1))`,
      [p.id],
    );
    check(
      "local хувилбарт сав → check",
      err2?.includes("check") ?? false,
      err2,
    );
    const err3 = await errorOf(
      a,
      "update extra_products set inventory_mode = 'shared_vial' where id = $1",
      [p.id],
    );
    check(
      "горим солих → EXTRA_MODE_IMMUTABLE",
      err3?.includes("EXTRA_MODE_IMMUTABLE") ?? false,
      err3,
    );
    const err4 = await errorOf(a, "delete from extra_products where id = $1", [
      p.id,
    ]);
    check(
      "устгах → EXTRA_DELETE_FORBIDDEN",
      err4?.includes("EXTRA_DELETE_FORBIDDEN") ?? false,
      err4,
    );
  });

  // ── Энгийн бараа (§7.2, §7.3) ──────────────────────────────────────
  await scenario(
    a,
    "Энгийн бараа: анхны тоо, хөдөлгөөн, нөөц засах",
    async () => {
      await flag(a, "extras_shop", true);
      const r = await save(
        a,
        {
          category_id: await categoryId(a, "gift-box"),
          slug: "t-box",
          name: "Test box",
          attrs: { capacity: 3 },
          variants: [
            { label: "Хар", price: 15000, initial_qty: 12 },
            { label: "Цагаан", price: 15000, initial_qty: 0 },
          ],
        },
        by,
      );
      const v = await one<{
        id: string;
        on_hand_qty: number;
        updated_at: string;
      }>(
        a,
        "select id, on_hand_qty, updated_at::text from extra_variants where extra_id = $1 and label = 'Хар'",
        [r.id],
      );
      check("анхны тоо 12", v.on_hand_qty === 12, v);
      const mv = await one<{ n: number; s: number }>(
        a,
        "select count(*)::int n, coalesce(sum(delta_on_hand),0)::int s from extra_movements where extra_variant_id = $1",
        [v.id],
      );
      check("нэг 'set' хөдөлгөөн, Σ = 12", mv.n === 1 && mv.s === 12, mv);

      const stale = await one<{ r: { ok: boolean; reason: string } }>(
        a,
        "select extras_set_stock($1, 20, $2::timestamptz - interval '1 second', '', $3) as r",
        [v.id, v.updated_at, by],
      );
      check(
        "хуучин updated_at → STALE",
        stale.r.ok === false && stale.r.reason === "STALE",
        stale.r,
      );

      // Захиалга reserve хийсэн мэт (3 ширхэг).
      await a.query(
        "select extra_stock_move($1, 'reserve', 0, 3, 'test:r1', null, '', null)",
        [v.id],
      );
      const fresh = await one<{ updated_at: string }>(
        a,
        "select updated_at::text from extra_variants where id = $1",
        [v.id],
      );
      const below = await one<{ r: { ok: boolean; reason: string } }>(
        a,
        "select extras_set_stock($1, 2, $2, '', $3) as r",
        [v.id, fresh.updated_at, by],
      );
      check(
        "захиалгад 3 → 2 оруулах → BELOW_RESERVED",
        below.r.reason === "BELOW_RESERVED",
        below.r,
      );
      const ok = await one<{ r: { ok: boolean; on_hand: number } }>(
        a,
        "select extras_set_stock($1, 40, $2, 'Шинэ ачаа', $3) as r",
        [v.id, fresh.updated_at, by],
      );
      check("40 болгоно", ok.r.ok && ok.r.on_hand === 40, ok.r);
      const sum = await one<{ s: number; on_hand_qty: number }>(
        a,
        `select (select sum(delta_on_hand) from extra_movements where extra_variant_id = $1)::int s,
              on_hand_qty from extra_variants where id = $1`,
        [v.id],
      );
      check(
        "эхний тоо + Σ хөдөлгөөн = одоогийн",
        sum.s === sum.on_hand_qty,
        sum,
      );

      const dup = await errorOf(a, "select extras_save($1::jsonb, null)", [
        JSON.stringify({
          id: r.id,
          slug: "t-box",
          name: "Test box",
          variants: [
            { label: "Хар", price: 1 },
            { label: " хар ", price: 1 },
          ],
        }),
      ]);
      check(
        "давхар нэртэй хувилбар → uq",
        dup?.includes("extra_variants_label_uq") ?? false,
        dup,
      );

      // Жагсаалтаас хасагдсан хувилбар устахгүй, идэвхгүй болно.
      await save(a, {
        id: r.id,
        slug: "t-box",
        name: "Test box",
        variants: [{ id: v.id, label: "Хар", price: 16000 }],
      });
      const white = await one<{ is_active: boolean }>(
        a,
        "select is_active from extra_variants where extra_id = $1 and label = 'Цагаан'",
        [r.id],
      );
      check("хасагдсан хувилбар идэвхгүй", white.is_active === false, white);
    },
  );

  await scenario(a, "Нийтлэх бэлэн эсэх", async () => {
    await flag(a, "extras_shop", true);
    const r = await save(a, {
      category_id: await categoryId(a, "syringe"),
      slug: "t-syr",
      name: "Шприц",
      variants: [{ label: "", price: 0 }],
    });
    const res = await one<{ r: { ok: boolean; missing: string[] } }>(
      a,
      "select extras_set_status($1, 'published', null) as r",
      [r.id],
    );
    check(
      "үнэгүй → PRICE_MISSING",
      !res.r.ok && res.r.missing.includes("PRICE_MISSING"),
      res.r,
    );
    await a.query(
      "update extra_variants set price = 3500 where extra_id = $1",
      [r.id],
    );
    const ok = await one<{ r: { ok: boolean } }>(
      a,
      "select extras_set_status($1, 'published', null) as r",
      [r.id],
    );
    check("үнэтэй → нийтлэгдэнэ", ok.r.ok, ok.r);
  });

  await scenario(
    a,
    "Туг OFF үед нийтэлсэн бараа нийтэд харагдахгүй (№27)",
    async () => {
      await flag(a, "extras_shop", true);
      const r = await save(a, {
        category_id: await categoryId(a, "syringe"),
        slug: "t-syr2",
        name: "Шприц",
        variants: [{ label: "", price: 3500, initial_qty: 5 }],
      });
      await a.query("select extras_set_status($1, 'published', null)", [r.id]);
      await a.query("set local role anon");
      const on = await one<{ n: number }>(
        a,
        "select count(*)::int n from extra_products where id = $1",
        [r.id],
      );
      await a.query("reset role");
      await flag(a, "extras_shop", false);
      await a.query("set local role anon");
      const off = await one<{ n: number }>(
        a,
        "select count(*)::int n from extra_products where id = $1",
        [r.id],
      );
      const offV = await one<{ n: number }>(
        a,
        "select count(*)::int n from extra_variants where extra_id = $1",
        [r.id],
      );
      await a.query("reset role");
      check("туг ON → anon харна", on.n === 1, on);
      check(
        "туг OFF → anon харахгүй (бараа, хувилбар)",
        off.n === 0 && offV.n === 0,
        { off, offV },
      );
    },
  );

  // ── Грамын сав ─────────────────────────────────────────────────────
  await scenario(a, "Грамын сав: туг, тоо оруулаагүй сав", async () => {
    await flag(a, "extras_shop", true);
    await flag(a, "vial_inventory", false);
    const cat = await categoryId(a, "vial");
    const pink10 = (
      await one<{ id: string }>(a, "select vial_for('pink', 10) id")
    ).id;
    const payload = {
      category_id: cat,
      slug: "t-vial",
      name: "Ягаан сав",
      variants: [{ vial_id: pink10, price: 2000 }],
    };
    const off = await errorOf(a, "select extras_save($1::jsonb, null)", [
      JSON.stringify(payload),
    ]);
    check(
      "vial_inventory OFF → FEATURE_DISABLED",
      off?.includes("FEATURE_DISABLED:vial_inventory") ?? false,
      off,
    );
    await flag(a, "vial_inventory", true);
    await a.query("select set_config('vonscent.stock_move', '1', true)");
    await a.query(
      "update vials set on_hand = null, reserved = 0 where id = $1",
      [pink10],
    );
    await a.query("select set_config('vonscent.stock_move', '', true)");
    const uncounted = await errorOf(a, "select extras_save($1::jsonb, null)", [
      JSON.stringify(payload),
    ]);
    check(
      "тоо оруулаагүй → VIAL_NOT_COUNTED",
      uncounted?.includes("VIAL_NOT_COUNTED") ?? false,
      uncounted,
    );
    await a.query(
      "select vial_stock_move($1, 'set', 40, 0, null, null, '', null)",
      [pink10],
    );
    const r = await save(a, payload);
    const v = await one<{ n: number; on_hand_qty: number }>(
      a,
      "select count(*)::int n, max(on_hand_qty)::int on_hand_qty from extra_variants where extra_id = $1",
      [r.id],
    );
    check("нэг хувилбар, өөрийн тоогүй", v.n === 1 && v.on_hand_qty === 0, v);
    const dup = await errorOf(a, "select extras_save($1::jsonb, null)", [
      JSON.stringify({
        ...payload,
        id: r.id,
        variants: [
          { vial_id: pink10, price: 2000 },
          { vial_id: pink10, price: 2000 },
        ],
      }),
    ]);
    check(
      "нэг савыг хоёр удаа → VIAL_DUPLICATE",
      dup?.includes("VIAL_DUPLICATE") ?? false,
      dup,
    );
  });

  // ── Үлдэгдэлтэй шил (§5.5) ────────────────────────────────────────
  await scenario(
    a,
    "Үлдэгдэлтэй шил: нийтлэх → ml засах → нуух → дахин нийтлэх",
    async () => {
      await flag(a, "extras_shop", true);
      const inv = await perfumeWithStock(a);
      const reservedBefore = inv.reserved_ml;
      const avail = inv.on_hand_ml - inv.reserved_ml;
      const r = await save(a, {
        category_id: await categoryId(a, "leftover"),
        slug: "t-left",
        name: "Үлдэгдэлтэй шил",
        leftover: {
          product_id: inv.product_id,
          remaining_ml: 18,
          full_ml: 100,
        },
        variants: [{ price: 25000 }],
      });
      const reserved = async () =>
        (
          await one<{ reserved_ml: number }>(
            a,
            "select reserved_ml from inventory where product_id = $1",
            [inv.product_id],
          )
        ).reserved_ml;
      check("ноорог үед түгжээгүй", (await reserved()) === reservedBefore);
      await a.query("select extras_set_status($1, 'published', null)", [r.id]);
      check("нийтлэхэд +18ml", (await reserved()) === reservedBefore + 18);

      await save(a, {
        id: r.id,
        slug: "t-left",
        name: "Үлдэгдэлтэй шил",
        leftover: {
          product_id: inv.product_id,
          remaining_ml: 20,
          full_ml: 100,
        },
        variants: [{ price: 25000 }],
      });
      check(
        "ml засахад түгжээ 20 болно",
        (await reserved()) === reservedBefore + 20,
      );
      const lock = await one<{ locked_ml: number; state: string }>(
        a,
        "select locked_ml, state from leftover_liquid_locks where extra_product_id = $1",
        [r.id],
      );
      check(
        "түгжээний мөр 1, listed, 20ml",
        lock.state === "listed" && lock.locked_ml === 20,
        lock,
      );

      const over = await errorOf(a, "select extras_save($1::jsonb, null)", [
        JSON.stringify({
          id: r.id,
          slug: "t-left",
          name: "Үлдэгдэлтэй шил",
          leftover: {
            product_id: inv.product_id,
            remaining_ml: avail + 1,
            full_ml: avail + 100,
          },
          variants: [{ price: 25000 }],
        }),
      ]);
      check(
        "боломжтойгоос их ml → LEFTOVER_STOCK:<max>",
        over?.includes(`LEFTOVER_STOCK:${avail}`) ?? false,
        over,
      );

      await a.query("select extras_set_status($1, 'draft', null)", [r.id]);
      check("нуухад суллагдана", (await reserved()) === reservedBefore);
      await a.query("select extras_set_status($1, 'published', null)", [r.id]);
      check(
        "дахин нийтлэхэд ижил мөр дахин түгжинэ",
        (await reserved()) === reservedBefore + 20,
      );
      const locks = await one<{ n: number }>(
        a,
        "select count(*)::int n from leftover_liquid_locks where extra_product_id = $1",
        [r.id],
      );
      check("түгжээний мөр нэг л", locks.n === 1, locks);

      // Захиалгад орсон мэт → засах, нуух боломжгүй.
      const item = await one<{ id: string }>(
        a,
        "select id from order_items limit 1",
      );
      await a.query(
        "update leftover_liquid_locks set state = 'reserved', order_item_id = $2 where extra_product_id = $1",
        [r.id, item.id],
      );
      const hide = await errorOf(
        a,
        "select extras_set_status($1, 'draft', null)",
        [r.id],
      );
      check(
        "захиалгад орсон шилийг нуух → LEFTOVER_IN_ORDER",
        hide?.includes("LEFTOVER_IN_ORDER") ?? false,
        hide,
      );

      // Зарагдсан (№23) → дахин нийтлэх боломжгүй.
      await a.query(
        "update leftover_liquid_locks set state = 'committed' where extra_product_id = $1",
        [r.id],
      );
      await a.query(
        "update extra_products set status = 'draft' where id = $1",
        [r.id],
      );
      const again = await one<{ r: { ok: boolean; missing: string[] } }>(
        a,
        "select extras_set_status($1, 'published', null) as r",
        [r.id],
      );
      check(
        "committed шилийг дахин нийтлэх → LEFTOVER_SOLD (№23)",
        !again.r.ok && again.r.missing.includes("LEFTOVER_SOLD"),
        again.r,
      );
    },
  );

  await scenario(
    a,
    "Үлдэгдэлтэй шил: туг OFF үед listing үүсэхгүй",
    async () => {
      await flag(a, "extras_shop", false);
      const inv = await perfumeWithStock(a);
      const r = await save(a, {
        category_id: await categoryId(a, "leftover"),
        slug: "t-left2",
        name: "Шил",
        leftover: { product_id: inv.product_id, remaining_ml: 5, full_ml: 50 },
        variants: [{ price: 10000 }],
      });
      const err = await errorOf(
        a,
        "select extras_set_status($1, 'published', null)",
        [r.id],
      );
      check(
        "FEATURE_DISABLED:extras_shop",
        err?.includes("FEATURE_DISABLED:extras_shop") ?? false,
        err,
      );
    },
  );

  // ════════════════════════════════════════════════════════════════════
  // Захиалга (PR6, §6)
  // ════════════════════════════════════════════════════════════════════

  await scenario(
    a,
    "Зөвхөн нэмэлт бараа: reserve → төлбөр → хүргэлт",
    async () => {
      const e = await localExtra(a, "t-o1", 15000, 5);
      const s = await order(a, [extraLine(e, 2)]);
      check("subtotal 30,000", s.subtotal === 30000, s);
      check(
        "мөр нэг, extra",
        s.lines.length === 1 && s.lines[0].line_kind === "extra",
        s.lines,
      );
      check(
        "reserved 2",
        (await variantStock(a, e.variantId)).reserved_qty === 2,
      );
      await a.query("select mark_order_paid($1, null, 'mock')", [s.order_id]);
      check(
        "төлбөрт хөдлөхгүй",
        (await variantStock(a, e.variantId)).reserved_qty === 2,
      );
      await status(a, s.order_id, "shipping");
      await status(a, s.order_id, "delivered");
      const st = await variantStock(a, e.variantId);
      check(
        "хүргэгдэхэд on_hand 3, reserved 0",
        st.on_hand_qty === 3 && st.reserved_qty === 0,
        st,
      );
      const it = await one<{ extra_state: string }>(
        a,
        "select extra_state from order_items where order_id = $1",
        [s.order_id],
      );
      check("extra_state committed", it.extra_state === "committed", it);
      // Ижил төлөв дахин → бүрэн no-op (№19, №24).
      const hist = async () =>
        (
          await one<{ n: number }>(
            a,
            "select count(*)::int n from order_status_history where order_id = $1",
            [s.order_id],
          )
        ).n;
      const before = await hist();
      await status(a, s.order_id, "delivered");
      check("давтан delivered → түүх нэмэгдэхгүй", (await hist()) === before);
      check(
        "давтан → нөөц хөдлөхгүй",
        (await variantStock(a, e.variantId)).on_hand_qty === 3,
      );
      await reconcile(a);
    },
  );

  await scenario(
    a,
    "Үнэ өөрчлөгдсөн → EXTRA_PRICE_CHANGED (№3), тоо хүрэхгүй",
    async () => {
      const e = await localExtra(a, "t-o2", 15000, 2);
      const err = await orderError(a, [extraLine(e, 1, 14000)]);
      check(
        "EXTRA_PRICE_CHANGED шинэ үнэтэй",
        (err?.includes("EXTRA_PRICE_CHANGED") && err.includes("15000")) ??
          false,
        err,
      );
      const err2 = await orderError(a, [extraLine(e, 3)]);
      check(
        "EXTRA_QTY_UNAVAILABLE (available 2)",
        (err2?.includes("EXTRA_QTY_UNAVAILABLE") &&
          err2.includes('"available": 2')) ??
          false,
        err2,
      );
      // Ижил хувилбар хоёр мөрөөр → нэгтгэнэ (№26).
      const err3 = await orderError(a, [extraLine(e, 2), extraLine(e, 1)]);
      check(
        "нэгтгэсэн 3 > 2 → EXTRA_QTY_UNAVAILABLE",
        err3?.includes("EXTRA_QTY_UNAVAILABLE") ?? false,
        err3,
      );
      const s = await order(a, [extraLine(e, 1), extraLine(e, 1)]);
      check(
        "нэгтгэсэн 2 → амжилттай",
        (await variantStock(a, e.variantId)).reserved_qty === 2,
        s,
      );
      await reconcile(a);
    },
  );

  await scenario(
    a,
    "qty 99 × хамгийн өндөр үнэ (№26) — int-д багтана",
    async () => {
      await flag(a, "extras_shop", true);
      const r = await save(a, {
        category_id: await categoryId(a, "gift-box"),
        slug: "t-o3",
        name: "Үнэтэй",
        variants: [{ label: "", price: 10000000, initial_qty: 1000 }],
      });
      await a.query("select extras_set_status($1, 'published', null)", [r.id]);
      const v = await one<{ id: string }>(
        a,
        "select id from extra_variants where extra_id = $1",
        [r.id],
      );
      const e = { variantId: v.id, price: 10000000 };
      const s = await order(a, [extraLine(e, 99)]);
      check("990,000,000₮", s.subtotal === 990000000, s.subtotal);
      const err = await orderError(a, [
        extraLine(e, 99),
        extraLine(e, 99),
        extraLine(e, 99),
      ]);
      check(
        "int-ээс хэтрэх → ORDER_TOO_LARGE",
        err?.includes("ORDER_TOO_LARGE") ?? false,
        err,
      );
    },
  );

  await scenario(
    a,
    "Хүргэхээс өмнө цуцлах → суллагдана; сэргээх → шинэ мөчлөг",
    async () => {
      const e = await localExtra(a, "t-o4", 15000, 5);
      const s = await order(a, [extraLine(e, 2)]);
      await status(a, s.order_id, "cancelled");
      check(
        "цуцлахад reserved 0",
        (await variantStock(a, e.variantId)).reserved_qty === 0,
      );
      await status(a, s.order_id, "pending");
      const it = await one<{ extra_state: string; c: number }>(
        a,
        `select i.extra_state, o.lifecycle_cycle c from order_items i join orders o on o.id = i.order_id
        where i.order_id = $1`,
        [s.order_id],
      );
      check(
        "сэргээхэд reserved, cycle 1",
        it.extra_state === "reserved" && it.c === 1,
        it,
      );
      check(
        "reserved дахин 2",
        (await variantStock(a, e.variantId)).reserved_qty === 2,
      );
      const keys = await one<{ n: number }>(
        a,
        `select count(*)::int n from extra_movements m join order_items i on i.id = m.order_item_id
        where i.order_id = $1 and m.kind = 'reserve'`,
        [s.order_id],
      );
      check("reserve хөдөлгөөн 2 (cycle 0 ба 1)", keys.n === 2, keys);
      await reconcile(a);
    },
  );

  await scenario(a, "Шил: A цуцлах → B авах → A сэргээх (№7)", async () => {
    const p = await perfume10(a);
    const l = await leftoverExtra(a, "t-o5", p.product_id);
    const A = await order(a, [extraLine(l)]);
    const err = await orderError(a, [extraLine(l)]);
    check(
      "2 дахь захиалга → LEFTOVER_ALREADY_SOLD",
      err?.includes("LEFTOVER_ALREADY_SOLD") ?? false,
      err,
    );
    await status(a, A.order_id, "cancelled");
    const lock = await one<{ state: string }>(
      a,
      "select state from leftover_liquid_locks where extra_product_id = $1",
      [l.extraId],
    );
    check("цуцлахад listed", lock.state === "listed", lock);
    const B = await order(a, [extraLine(l)]);
    const restore = await errorOf(
      a,
      "select update_order_status($1, 'pending', 'x', null)",
      [A.order_id],
    );
    check(
      "A сэргээх → LEFTOVER_RESTORE_CONFLICT",
      restore?.includes("LEFTOVER_RESTORE_CONFLICT") ?? false,
      restore,
    );
    // B хүргэгдэхэд шингэн эх үнэртнээс бүрмөсөн хасагдана.
    const inv0 = await one<{ on_hand_ml: number; reserved_ml: number }>(
      a,
      "select on_hand_ml, reserved_ml from inventory where product_id = $1",
      [p.product_id],
    );
    await a.query("select mark_order_paid($1, null, 'mock')", [B.order_id]);
    await status(a, B.order_id, "shipping");
    await status(a, B.order_id, "delivered");
    const inv1 = await one<{ on_hand_ml: number; reserved_ml: number }>(
      a,
      "select on_hand_ml, reserved_ml from inventory where product_id = $1",
      [p.product_id],
    );
    check(
      "хүргэлтэд on_hand −10, reserved −10",
      inv1.on_hand_ml === inv0.on_hand_ml - 10 &&
        inv1.reserved_ml === inv0.reserved_ml - 10,
      { inv0, inv1 },
    );
    const lock2 = await one<{ state: string }>(
      a,
      "select state from leftover_liquid_locks where extra_product_id = $1",
      [l.extraId],
    );
    check("lock committed", lock2.state === "committed", lock2);
    await reconcile(a);
  });

  await scenario(a, "Төлөвийн шилжилт SQL-д (№9, №17, №18)", async () => {
    const e = await localExtra(a, "t-o6", 15000, 5);
    const s = await order(a, [extraLine(e)]);
    const bad = await errorOf(
      a,
      "select update_order_status($1, 'delivered', 'x', null)",
      [s.order_id],
    );
    check(
      "pending → delivered → ILLEGAL_TRANSITION",
      bad?.includes("ILLEGAL_TRANSITION") ?? false,
      bad,
    );
    await status(a, s.order_id, "confirmed");
    const unpaid = await errorOf(
      a,
      "select update_order_status($1, 'shipping', 'x', null)",
      [s.order_id],
    );
    check(
      "төлөөгүй → shipping → PAYMENT_REQUIRED (№17)",
      unpaid?.includes("PAYMENT_REQUIRED") ?? false,
      unpaid,
    );
    await status(a, s.order_id, "cancelled");
    const late = await errorOf(a, "select mark_order_paid($1, null, 'qpay')", [
      s.order_id,
    ]);
    check(
      "цуцлагдсанд хожуу QPay → ORDER_CANCELLED (№18)",
      late?.includes("ORDER_CANCELLED") ?? false,
      late,
    );
    const s2 = await order(a, [extraLine(e)]);
    await a.query("select mark_order_paid($1, null, 'mock')", [s2.order_id]);
    await status(a, s2.order_id, "shipping");
    await status(a, s2.order_id, "delivered");
    await a.query("select mark_order_refunded($1, null, 0, false)", [
      s2.order_id,
    ]);
    const reopen = await errorOf(
      a,
      "select update_order_status($1, 'shipping', 'x', null)",
      [s2.order_id],
    );
    check(
      "буцаасан → shipping → ILLEGAL_TRANSITION",
      reopen?.includes("ILLEGAL_TRANSITION") ?? false,
      reopen,
    );
    const latePaid = await errorOf(
      a,
      "select mark_order_paid($1, null, 'qpay')",
      [s2.order_id],
    );
    check(
      "буцаасанд хожуу QPay → өөрчлөгдөхгүй",
      latePaid === null || latePaid.includes("ILLEGAL_TRANSITION"),
      latePaid,
    );
    const ps = await one<{ payment_status: string }>(
      a,
      "select payment_status from orders where id = $1",
      [s2.order_id],
    );
    check(
      "payment_status refunded хэвээр",
      ps.payment_status === "refunded",
      ps,
    );
  });

  await scenario(
    a,
    "Хэсэгчилсэн restock, ижил хүсэлт давтах (№8), хуучин signature (№25)",
    async () => {
      const e = await localExtra(a, "t-o7", 15000, 5);
      const s = await order(a, [extraLine(e, 3)]);
      await a.query("select mark_order_paid($1, null, 'mock')", [s.order_id]);
      await status(a, s.order_id, "shipping");
      await status(a, s.order_id, "delivered");
      const item = s.lines[0].id;
      const restock = (n: number) =>
        a.query(
          "select mark_order_refunded($1, null, 0, false, $2::jsonb) as r",
          [
            s.order_id,
            JSON.stringify([{ order_item_id: item, restocked_qty: n }]),
          ],
        );
      await restock(1);
      check(
        "1 буцаахад on_hand 3",
        (await variantStock(a, e.variantId)).on_hand_qty === 3,
      );
      await restock(1);
      check(
        "ижил хүсэлт давтахад 3 хэвээр",
        (await variantStock(a, e.variantId)).on_hand_qty === 3,
      );
      await restock(2);
      check(
        "2 болгоход on_hand 4",
        (await variantStock(a, e.variantId)).on_hand_qty === 4,
      );
      const down = await errorOf(
        a,
        "select mark_order_refunded($1, null, 0, false, $2::jsonb)",
        [
          s.order_id,
          JSON.stringify([{ order_item_id: item, restocked_qty: 1 }]),
        ],
      );
      check(
        "буурах → RESTOCK_INVALID",
        down?.includes("RESTOCK_INVALID") ?? false,
        down,
      );
      const old = await one<{ n: number }>(
        a,
        "select count(*)::int n from pg_proc where proname = 'mark_order_refunded'",
      );
      check("mark_order_refunded overload нэг л (№25)", old.n === 1, old);
      await reconcile(a);
    },
  );

  await scenario(a, "Туг ON → reserve → OFF → цуцлах (№11)", async () => {
    const e = await localExtra(a, "t-o8", 15000, 5);
    const s = await order(a, [extraLine(e, 2)]);
    await flag(a, "extras_shop", false);
    const blocked = await orderError(a, [extraLine(e)]);
    check(
      "OFF үед шинэ reserve → EXTRAS_DISABLED",
      blocked?.includes("EXTRAS_DISABLED") ?? false,
      blocked,
    );
    await status(a, s.order_id, "cancelled");
    check(
      "OFF үед цуцлалт суллана",
      (await variantStock(a, e.variantId)).reserved_qty === 0,
    );
    const mv = await one<{ n: number }>(
      a,
      "select count(*)::int n from extra_movements where extra_variant_id = $1 and kind = 'release'",
      [e.variantId],
    );
    check("release хөдөлгөөн бичигдсэн", mv.n === 1, mv);
    await reconcile(a);
  });

  await scenario(
    a,
    "Баталсан дүн (№14, №16): COUPON / SHIPPING / TOTAL_CHANGED",
    async () => {
      const e = await localExtra(a, "t-o9", 15000, 5);
      const user = await customerId(a);
      const base = {
        subtotal: 15000,
        discount: 0,
        loyalty_used: 0,
        shipping_fee: 5000,
        total: 20000,
      };
      const ok = await order(a, [extraLine(e)], {
        user,
        shipping: 5000,
        expected: base,
      });
      check("тэнцүү → амжилттай", ok.total === 20000, ok);
      const ship = await orderError(a, [extraLine(e)], {
        user,
        shipping: 6000,
        expected: base,
      });
      check(
        "хүргэлт өөр → SHIPPING_CHANGED",
        ship?.includes("SHIPPING_CHANGED") ?? false,
        ship,
      );
      const tot = await orderError(a, [extraLine(e)], {
        user,
        shipping: 5000,
        expected: { ...base, subtotal: 14000, total: 19000 },
      });
      check(
        "subtotal өөр → TOTAL_CHANGED",
        tot?.includes("TOTAL_CHANGED") ?? false,
        tot,
      );
      await a.query(
        `insert into coupons (code, user_id, type, value, min_subtotal, max_uses, is_active)
       values ('TEXTRA1', $1, 'fixed', 1000, 0, 1, true)`,
        [user],
      );
      const withCoupon = { ...base, discount: 1000, total: 19000 };
      const used = await order(a, [extraLine(e)], {
        user,
        shipping: 5000,
        coupon: "TEXTRA1",
        expected: withCoupon,
      });
      check("купон 1,000 хасагдсан", used.discount === 1000, used);
      const again = await orderError(a, [extraLine(e)], {
        user,
        shipping: 5000,
        coupon: "TEXTRA1",
        expected: withCoupon,
      });
      check(
        "купон дууссан → COUPON_CHANGED (№14)",
        again?.includes("COUPON_CHANGED") ?? false,
        again,
      );
      // Оноо өөр захиалгад ашиглагдсан (№15).
      await a.query("update profiles set loyalty_points = 1000 where id = $1", [
        user,
      ]);
      const rate = await one<{ v: number }>(
        a,
        "select coalesce((value->>'redeemRate')::numeric,1)::float8 v from settings where key='loyalty'",
      );
      const pts = Math.floor(1000 * rate.v);
      const exp = { ...base, loyalty_used: pts, total: 20000 - pts };
      await order(a, [extraLine(e)], {
        user,
        shipping: 5000,
        loyalty: pts,
        expected: exp,
      });
      const l2 = await orderError(a, [extraLine(e)], {
        user,
        shipping: 5000,
        loyalty: pts,
        expected: exp,
      });
      check(
        "оноо дууссан → LOYALTY_CHANGED (№15)",
        l2?.includes("LOYALTY_CHANGED") ?? false,
        l2,
      );
      await reconcile(a);
    },
  );

  await scenario(
    a,
    "Бэлэг SQL-д: босго, хасагдсаныг хадгална, replay ижил (№4, №13)",
    async () => {
      const { giftAllowanceFor } = await import("../src/lib/gift");
      for (const goods of [
        0, 199_999, 200_000, 399_999, 400_000, 1_600_000, 3_000_000,
      ]) {
        const sql = (
          await one<{ n: number }>(a, "select gift_entitlement($1) n", [goods])
        ).n;
        check(
          `gift_entitlement(${goods}) = TS ${giftAllowanceFor(goods)}`,
          sql === giftAllowanceFor(goods),
          sql,
        );
      }
      const p = await perfume10(a);
      const g1 = await perfume10(a, 1);
      const g2 = await perfume10(a, 2);
      await a.query(
        `insert into settings (key, value) values ('gift', $1::jsonb)
         on conflict (key) do update set value = excluded.value`,
        [
          JSON.stringify({
            enabled: true,
            productIds: [g1.product_id, g2.product_id],
          }),
        ],
      );
      const qty = Math.ceil(200_000 / p.price);
      const s = await order(a, [perfumeLine(p, qty)], {
        gifts: [g1.product_id, g2.product_id],
      });
      const gifts = s.lines.filter((l) => l.is_gift);
      const ent = Math.floor((p.price * qty) / 200_000);
      check(
        `эрх ${ent}: ${Math.min(ent, 2)} бэлэг орсон`,
        gifts.length === Math.min(ent, 2),
        s.lines,
      );
      if (ent < 2) {
        check(
          "илүү сонголт omitted (threshold)",
          s.omitted_gifts.some((g) => g.reason === "threshold"),
          s.omitted_gifts,
        );
      }
      const replay = await one<{ r: Summary }>(
        a,
        "select order_summary($1) r",
        [s.order_id],
      );
      check(
        "order_summary = place_order-ийн хариу",
        JSON.stringify(replay.r) === JSON.stringify(s),
        { replay: replay.r, s },
      );
      await reconcile(a);
    },
  );

  await scenario(
    a,
    "Савны тоон нөөц: null үед захиалга → тоолж эхлэх → хүргэлт (№20, №6)",
    async () => {
      await flag(a, "vial_inventory", true);
      const p = await perfume10(a);
      const style = (
        await one<{ s: string }>(a, "select perfume_vial_style($1, 10) s", [
          p.product_id,
        ])
      ).s;
      const vial = (
        await one<{ id: string }>(a, "select vial_for($1, 10) id", [style])
      ).id;
      await a.query("select set_config('vonscent.stock_move', '1', true)");
      await a.query(
        "update vials set on_hand = null, reserved = 0 where id = $1",
        [vial],
      );
      await a.query("delete from vial_movements where vial_id = $1", [vial]);
      await a.query("select set_config('vonscent.stock_move', '', true)");
      const s = await order(a, [perfumeLine(p)]);
      const v1 = await one<{ on_hand: number | null; reserved: number }>(
        a,
        "select on_hand, reserved from vials where id = $1",
        [vial],
      );
      check(
        "тоолоогүй ч reserved 1",
        v1.on_hand === null && v1.reserved === 1,
        v1,
      );
      await a.query(
        "select vial_stock_move($1, 'set', 40, 0, null, null, '', null)",
        [vial],
      );
      const v2 = await one<{ a: number }>(
        a,
        "select vial_available_qty($1) a",
        [vial],
      );
      check("40 оруулахад зарах боломжтой 39", v2.a === 39, v2);
      await a.query("select mark_order_paid($1, null, 'mock')", [s.order_id]);
      await status(a, s.order_id, "shipping");
      await status(a, s.order_id, "delivered");
      const v3 = await one<{ on_hand: number; reserved: number }>(
        a,
        "select on_hand, reserved from vials where id = $1",
        [vial],
      );
      check("хүргэгдэхэд 39 / 0", v3.on_hand === 39 && v3.reserved === 0, v3);
      // Сүүлийн нэг сав: үнэртэн ба тусад нь зарж буй сав (№6).
      await a.query(
        "select vial_stock_move($1, 'set', -38, 0, null, null, '', null)",
        [vial],
      );
      await flag(a, "extras_shop", true);
      const r = await save(a, {
        category_id: await categoryId(a, "vial"),
        slug: "t-o10",
        name: "Сав",
        variants: [{ vial_id: vial, price: 2000 }],
      });
      await a.query("select extras_set_status($1, 'published', null)", [r.id]);
      const ve = await one<{ id: string }>(
        a,
        "select id from extra_variants where extra_id = $1",
        [r.id],
      );
      await order(a, [perfumeLine(p)]);
      const err = await orderError(a, [
        extraLine({ variantId: ve.id, price: 2000 }),
      ]);
      check(
        "сүүлийн сав үнэртэнд орсон → VIAL_UNAVAILABLE",
        err?.includes("VIAL_UNAVAILABLE") ?? false,
        err,
      );
      await reconcile(a);
    },
  );

  await scenario(
    a,
    "Холимог захиалгын тайлан: perfume_goods + extras_goods = goods (№28)",
    async () => {
      const e = await localExtra(a, "t-o11", 15000, 5);
      const p = await perfume10(a);
      const s = await order(a, [perfumeLine(p), extraLine(e, 2)]);
      await a.query("select mark_order_paid($1, null, 'mock')", [s.order_id]);
      await a.query("set local role authenticated");
      const staff = by;
      await a.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: staff, role: "authenticated" }),
      ]);
      const ev = await one<{
        goods: number;
        perfume_goods: number;
        extras_goods: number;
      }>(
        a,
        "select goods, perfume_goods, extras_goods from admin_report_events(null, null, 1) where order_id = $1 and kind = 'sale'",
        [s.order_id],
      );
      await a.query("reset role");
      check("extras_goods 30,000", ev?.extras_goods === 30000, ev);
      check(
        "perfume + extras = goods",
        ev && ev.perfume_goods + ev.extras_goods === ev.goods,
        ev,
      );
    },
  );

  await scenario(
    a,
    "Төлсөн захиалга цуцлах → сэргээх: дүн хэвээр (№29)",
    async () => {
      const e = await localExtra(a, "t-o12", 15000, 5);
      const s = await order(a, [extraLine(e, 1)]);
      await a.query("select mark_order_paid($1, null, 'mock')", [s.order_id]);
      await status(a, s.order_id, "cancelled");
      await status(a, s.order_id, "pending");
      const o = await one<{ total: number; subtotal: number }>(
        a,
        "select total, subtotal from orders where id = $1",
        [s.order_id],
      );
      check("дүн хэвээр", o.total === s.total && o.subtotal === s.subtotal, o);
      check(
        "reserved 1",
        (await variantStock(a, e.variantId)).reserved_qty === 1,
      );
      await reconcile(a);
    },
  );

  await scenario(
    a,
    "Cron: сэргээсэн төлсөн pending → хүргэлтэд (review 🔴1)",
    async () => {
      const e = await localExtra(a, "t-cron", 15000, 5);
      const s = await order(a, [extraLine(e)]);
      await a.query("select mark_order_paid($1, null, 'mock')", [s.order_id]);
      await status(a, s.order_id, "cancelled");
      await status(a, s.order_id, "pending");
      await a.query(
        "update orders set deliver_on = (now() at time zone 'Asia/Ulaanbaatar')::date where id = $1",
        [s.order_id],
      );
      await a.query("select auto_dispatch_orders()");
      const o = await one<{ status: string }>(
        a,
        "select status from orders where id = $1",
        [s.order_id],
      );
      check("pending+paid → shipping (унахгүй)", o.status === "shipping", o);
      await reconcile(a);
    },
  );

  // ── Холимог хоёр захиалга урвуу дарааллаар — deadlock-гүй (№10) ──────
  console.log("\nУрвуу дараалалтай хоёр захиалга (№10)");
  current = "№10";
  const b = await connectDb(url!);
  const x = await perfume10(a, 0);
  const y = await perfume10(a, 1);
  try {
    await a.query("begin");
    await order(a, [perfumeLine(x), perfumeLine(y)]);
    await b.query("begin");
    await b.query("set local lock_timeout = '1500ms'");
    let code: string | undefined;
    try {
      await order(b, [perfumeLine(y), perfumeLine(x)]);
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    await b.query("rollback");
    // Ижил дарааллаар (id) түгждэг тул B эхний мөрөн дээр л хүлээнэ — deadlock
    // (40P01) биш, lock_timeout (55P03).
    check("B хүлээсэн (55P03), deadlock биш", code === "55P03", code);
  } finally {
    await a.query("rollback").catch(() => {});
    await b.end();
  }

  await a.end();
  if (failed === 0) console.log("\n✅ Бүгд амжилттай.");
  else {
    console.log(`\n✖ ${failed} алдаа:`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
