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
