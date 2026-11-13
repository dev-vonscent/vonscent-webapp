/**
 * Арга хэмжээний (0181_sale_events) integration тест — бодит Postgres.
 *
 *   pnpm db:test-sale-events-dev      # зөвхөн .env.dev
 *
 * docs/campaigns/plan.md §13.1. Сан бохирдуулахгүй: сценари бүр
 * `begin … rollback` дотор (тугийн утгыг ч транзакц дотор сольж буцаана).
 * Транзакц дотор `now()` тогтмол тул «эхлээгүй / явж байгаа / дууссан»-ыг
 * хугацааг `now()`-оос шилжүүлж үүсгэнэ.
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

async function scenario(c: Client, name: string, body: () => Promise<void>) {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    // Dev санд админы жинхэнэ арга хэмжээ байж болно — давхцал, үнэд
    // нөлөөлөхгүйн тулд транзакц дотор түр унтраана.
    await c.query("update sale_events set is_active = false where is_active");
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
    `insert into feature_flags (key, enabled) values ('sale_events', $1)
       on conflict (key) do update set enabled = excluded.enabled`,
    [on],
  );
}

/** Алдааны мессеж (амжилттай бол null) — savepoint дотор, гадна транзакц үргэлжилнэ. */
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

interface Fixture {
  user: string;
  product: string;
  other: string;
  variant: string;
  ml: number;
  price: number;
}

async function loadFixture(c: Client): Promise<Fixture> {
  const users = await c.query<{ id: string }>(
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 1`,
  );
  // Бараа: үлдэгдэлтэй, зарагдаж буй хэмжээтэй, үндсэн үнэ ≥ 10,000.
  const rows = await c.query<{
    product_id: string;
    variant_id: string;
    ml: number;
    price: number;
  }>(`
    select i.product_id, pv.id as variant_id, pv.ml, pv.price
      from inventory i
      join products p on p.id = i.product_id
      join product_variants pv on pv.product_id = p.id
     where i.on_hand_ml - i.reserved_ml >= 100
       and p.is_active and p.status = 'active'
       and pv.is_active and pv.price >= 10000
       and variant_sellable(pv.*, p.gender, i.is_sold_out, i.on_hand_ml - i.reserved_ml)
     order by pv.ml, p.name
     limit 20`);
  const first = rows.rows[0];
  const other = rows.rows.find((r) => r.product_id !== first?.product_id);
  if (!users.rows[0] || !first || !other) {
    throw new Error("Dev санд хэрэглэгч ба үлдэгдэлтэй 2 бараа хэрэгтэй.");
  }
  return {
    user: users.rows[0].id,
    product: first.product_id,
    other: other.product_id,
    variant: first.variant_id,
    ml: first.ml,
    price: first.price,
  };
}

/** `event_discount_price`-ийн толь: 100₮-д дугуйрна, үндсэн үнээс давахгүй. */
const pctPrice = (price: number, pct: number) =>
  Math.min(price, Math.round((price * (100 - pct)) / 100 / 100) * 100);

async function saveEvent(
  c: Client,
  f: Fixture,
  opts: {
    id?: string | null;
    slug?: string;
    name?: string;
    from?: string;
    to?: string;
    active?: boolean;
    items?: { productId: string; pcts: Record<string, number> }[];
  } = {},
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `select save_sale_event($1, jsonb_build_object(
        'slug', $2::text, 'name', $3::text,
        'startsAt', ${opts.from ?? "now() - interval '1 hour'"},
        'endsAt', ${opts.to ?? "now() + interval '1 hour'"},
        'isActive', $4::boolean, 'showCountdown', true),
       $5::jsonb, null) as id`,
    [
      opts.id ?? null,
      opts.slug ?? "test-bf",
      opts.name ?? "Тест BF",
      opts.active ?? true,
      JSON.stringify(
        opts.items ?? [
          { productId: f.product, pcts: { [String(f.ml)]: 20 } },
        ],
      ),
    ],
  );
  return rows[0].id;
}

async function priceOf(c: Client, variant: string) {
  const { rows } = await c.query<{ p: number; on: boolean }>(
    `select variant_price(pv.*) as p, variant_sale_active(pv.*) as on
       from product_variants pv where pv.id = $1`,
    [variant],
  );
  return rows[0];
}

async function setManual(c: Client, f: Fixture, pct: number | null) {
  await c.query(
    `update product_variants
        set sale_price = $2, sale_starts_at = null, sale_ends_at = $3
      where id = $1`,
    [
      f.variant,
      pct == null ? null : pctPrice(f.price, pct),
      // Гар хямдрал арга хэмжээнээс УРТ (+1 өдөр) — арга хэмжээ дууссаны
      // дараа үргэлжлэх ёстой.
      pct == null ? null : new Date(Date.now() + 86_400_000).toISOString(),
    ],
  );
}

async function main() {
  const c = await connectDb(url!);
  const f = await loadFixture(c);
  const sale20 = pctPrice(f.price, 20);
  console.log(`Бараа ${f.product} ${f.ml}ml: ${f.price} → 20% = ${sale20}`);

  await scenario(c, "1. Туг хаалттай — арга хэмжээ үл тоомсорлогдоно", async () => {
    await saveEvent(c, f);
    await setFlag(c, false);
    const p = await priceOf(c, f.variant);
    check("variant_price = үндсэн", p.p === f.price, p);
    check("variant_sale_active = false", p.on === false, p);
    const live = await c.query("select * from live_sale_events()");
    check("live_sale_events хоосон", live.rowCount === 0);
    const err = await errorOf(
      c,
      `select save_sale_event(null, '{"slug":"x-y","name":"x","startsAt":"2030-01-01T00:00:00Z","endsAt":"2030-01-02T00:00:00Z"}', '[]')`,
    );
    check("save_sale_event → FEATURE_DISABLED", /FEATURE_DISABLED/.test(err?.message ?? ""), err?.message);
  });

  await scenario(c, "2. Эхлээгүй / явж байгаа / дууссан", async () => {
    const id = await saveEvent(c, f, {
      from: "now() + interval '1 hour'",
      to: "now() + interval '2 hours'",
    });
    check("эхлээгүй → үндсэн", (await priceOf(c, f.variant)).p === f.price);
    await saveEvent(c, f, { id });
    const live = await priceOf(c, f.variant);
    check("явж байгаа → хямдарсан", live.p === sale20, live);
    check("явж байгаа → sale_active", live.on === true);
    await saveEvent(c, f, {
      id,
      from: "now() - interval '2 hours'",
      to: "now()",
    });
    check("дууссан (ends_at = now, exclusive) → үндсэн", (await priceOf(c, f.variant)).p === f.price);
  });

  await scenario(c, "3. Ноорог (is_active = false) — нөлөөгүй", async () => {
    await saveEvent(c, f, { active: false });
    check("үндсэн үнэ", (await priceOf(c, f.variant)).p === f.price);
  });

  await scenario(c, "4. Гар хямдрал + арга хэмжээ — хамгийн хямд нь", async () => {
    await setManual(c, f, 10);
    const id = await saveEvent(c, f);
    check("гар 10% + арга хэмжээ 20% → 20%", (await priceOf(c, f.variant)).p === sale20);
    await setManual(c, f, 30);
    check("гар 30% + арга хэмжээ 20% → 30%", (await priceOf(c, f.variant)).p === pctPrice(f.price, 30));
    await saveEvent(c, f, { id, from: "now() - interval '2 hours'", to: "now()" });
    check("арга хэмжээ дууссаны дараа гар хямдрал хэвээр", (await priceOf(c, f.variant)).p === pctPrice(f.price, 30));
    const row = await c.query("select sale_price from product_variants where id = $1", [f.variant]);
    check("sale_price хөндөгдөөгүй", row.rows[0].sale_price === pctPrice(f.price, 30));
  });

  await scenario(c, "5. Давхцал", async () => {
    await saveEvent(c, f, { slug: "ev-a", name: "A" });
    const err = await errorOf(
      c,
      `select save_sale_event(null, jsonb_build_object('slug','ev-b','name','B',
         'startsAt', now(), 'endsAt', now() + interval '3 hours', 'isActive', true),
         $1::jsonb)`,
      [JSON.stringify([{ productId: f.product, pcts: {} }])],
    );
    check("давхцсан → EVENT_OVERLAP", /EVENT_OVERLAP/.test(err?.message ?? ""), err?.message);
    check("detail-д барааны нэр", Boolean(err?.detail?.includes('"event": "A"')), err?.detail);
    const ok = await errorOf(
      c,
      `select save_sale_event(null, jsonb_build_object('slug','ev-c','name','C',
         'startsAt', now() + interval '1 hour', 'endsAt', now() + interval '3 hours', 'isActive', true),
         $1::jsonb)`,
      [JSON.stringify([{ productId: f.product, pcts: {} }])],
    );
    check("давхцахгүй (A дууссаны дараа эхэлнэ) → OK", ok === null, ok?.message);
    const draft = await errorOf(
      c,
      `select save_sale_event(null, jsonb_build_object('slug','ev-d','name','D',
         'startsAt', now(), 'endsAt', now() + interval '3 hours', 'isActive', false),
         $1::jsonb)`,
      [JSON.stringify([{ productId: f.product, pcts: {} }])],
    );
    check("ноорог давхцаж болно", draft === null, draft?.message);
  });

  await scenario(c, "6. Дугуйрал, үндсэн үнээс давахгүй", async () => {
    const { rows } = await c.query<{ a: number; b: number; c: number; d: number | null }>(
      `select event_discount_price(10560, 0) as a, event_discount_price(45000, 20) as b,
              event_discount_price(18000, 1) as c, event_discount_price(18000, null) as d`,
    );
    check("0% → үндсэн (дээш дугуйрахгүй)", rows[0].a === 10560, rows[0]);
    check("45,000 −20% = 36,000", rows[0].b === 36000, rows[0]);
    check("18,000 −1% = 17,800", rows[0].c === 17800, rows[0]);
    check("хувьгүй → null", rows[0].d === null, rows[0]);
  });

  await scenario(c, "7. place_order — арга хэмжээний үнээр, хуучин дүн → TOTAL_CHANGED", async () => {
    await saveEvent(c, f);
    const order = (expected?: number) =>
      c.query<{ r: { order_id: string } }>(
        "select place_order($1::jsonb, $2::jsonb) as r",
        [
          JSON.stringify({
            user_id: f.user,
            contact_name: "Sale event test",
            contact_phone: "99000000",
            ship_detail: "test",
            shipping_fee: 0,
            ...(expected != null
              ? { expected: { subtotal: expected, discount: 0, loyalty_used: 0 } }
              : {}),
          }),
          JSON.stringify([
            { product_id: f.product, variant_id: f.variant, ml: f.ml, qty: 1 },
          ]),
        ],
      );
    const { rows } = await order();
    const o = await c.query<{ subtotal: number }>(
      "select subtotal from orders where id = $1",
      [rows[0].r.order_id],
    );
    check("subtotal = арга хэмжээний үнэ", Number(o.rows[0].subtotal) === sale20, o.rows[0]);
    await c.query("savepoint t");
    try {
      await order(f.price);
      check("хуучин (үндсэн) дүнтэй → TOTAL_CHANGED", false);
    } catch (e) {
      check("хуучин (үндсэн) дүнтэй → TOTAL_CHANGED", /TOTAL_CHANGED/.test((e as Error).message), (e as Error).message);
    }
    await c.query("rollback to savepoint t");
    // Бэлэн багцын мөр: TS үндсэн үнээс бодсон unit_price нь арга хэмжээний
    // үнээс ИХ байж болно (§5.3) — хүлээж авна, gross сөрөг болохгүй.
    const bundle = await c.query<{ r: { order_id: string } }>(
      "select place_order($1::jsonb, $2::jsonb) as r",
      [
        JSON.stringify({
          user_id: f.user,
          contact_name: "Bundle test",
          contact_phone: "99000000",
          ship_detail: "test",
          shipping_fee: 0,
        }),
        JSON.stringify([
          {
            product_id: f.product,
            variant_id: f.variant,
            ml: f.ml,
            qty: 1,
            kind: "bundle",
            unit_price: f.price - 100,
            collection_name: "Тест багц",
          },
        ]),
      ],
    );
    const b = await c.query<{ subtotal: number; unit_price: number; list_price: number }>(
      `select o.subtotal, i.unit_price, i.list_price
         from orders o join order_items i on i.order_id = o.id where o.id = $1`,
      [bundle.rows[0].r.order_id],
    );
    check("бэлэн багцын unit_price хэвээр (үндсэн − хувь)", b.rows[0]?.unit_price === f.price - 100, b.rows[0]);
    check("list_price ≥ unit_price", (b.rows[0]?.list_price ?? 0) >= (b.rows[0]?.unit_price ?? 1), b.rows[0]);
  });

  await scenario(c, "8. Каталог: p_event, catalog_items ↔ variant_price", async () => {
    await saveEvent(c, f, {
      slug: "cat-ev",
      items: [
        { productId: f.product, pcts: { [String(f.ml)]: 20 } },
        { productId: f.other, pcts: {} },
      ],
    });
    const { rows } = await c.query<{ id: string }>(
      "select id from catalog_search(p_event => 'cat-ev', p_per_page => 100)",
    );
    const ids = new Set(rows.map((r) => r.id));
    check("зөвхөн гишүүд (2)", ids.size === 2 && ids.has(f.product) && ids.has(f.other), [...ids]);
    const none = await c.query("select id from catalog_search(p_event => 'no-such')");
    check("олдохгүй slug → хоосон", none.rowCount === 0);
    const old = await c.query("select count(*)::int as n from catalog_search(p_per_page => 5)");
    check("хуучин нэрлэсэн дуудлага (p_event-гүй) ажиллана", old.rows[0].n > 0);
    const diff = await c.query<{ id: string; cat: number; vp: number }>(`
      select c.id, c.starting_price as cat,
             (select min(variant_price(pv.*)) from product_variants pv
               where pv.product_id = c.id and pv.is_active
                 and pv.ml = any (c.sellable_mls)) as vp
        from catalog_items c
       where c.sellable_count > 0
         and c.starting_price <> (select min(variant_price(pv.*)) from product_variants pv
               where pv.product_id = c.id and pv.is_active and pv.ml = any (c.sellable_mls))`);
    check("catalog_items.starting_price = min(variant_price) бүх бараанд", diff.rowCount === 0, diff.rows.slice(0, 3));
  });

  await scenario(c, "9. «Хямдрал» таг шууд (trigger)", async () => {
    await c.query(
      "update product_variants set sale_price = null, sale_starts_at = null, sale_ends_at = null where product_id = $1",
      [f.product],
    );
    const tagged = async () =>
      (
        await c.query(
          `select 1 from product_tags pt join tags t on t.id = pt.tag_id
            where t.kind = 'sale' and pt.product_id = $1`,
          [f.product],
        )
      ).rowCount === 1;
    check("арга хэмжээгүй → тагүй", !(await tagged()));
    const id = await saveEvent(c, f);
    check("нийтлэхэд таг шууд", await tagged());
    await c.query("select stop_sale_event($1)", [id]);
    // stop нь ends_at = now() — транзакц дотор now() тогтмол тул шууд дууссан.
    check("зогсооход таг алга", !(await tagged()));
  });

  await scenario(c, "10. Эрх (anon)", async () => {
    await saveEvent(c, f, { slug: "live-ev" });
    await saveEvent(c, f, {
      slug: "sched-ev",
      name: "Товлосон",
      from: "now() + interval '5 hours'",
      to: "now() + interval '6 hours'",
      items: [{ productId: f.other, pcts: { [String(f.ml)]: 50 } }],
    });
    await c.query("set local role anon");
    const t1 = await c.query("select * from sale_events");
    const t2 = await c.query("select * from sale_event_discounts");
    check("sale_events шууд select → 0 мөр", t1.rowCount === 0);
    check("sale_event_discounts шууд select → 0 мөр", t2.rowCount === 0);
    const live = await c.query<{ slug: string }>("select slug from live_sale_events()");
    check("live_sale_events товлосныг буцаахгүй", live.rows.every((r) => r.slug !== "sched-ev") && live.rows.some((r) => r.slug === "live-ev"), live.rows);
    const pub = await c.query("select * from sale_event_public('sched-ev')");
    check("sale_event_public → scheduled, хувь/бараа байхгүй", pub.rows[0]?.state === "scheduled" && !("pct" in pub.rows[0]) && !("product_ids" in pub.rows[0]), pub.rows[0]);
    const ids = await c.query("select * from sale_event_product_ids('sched-ev')");
    check("товлосны гишүүд нээгдэхгүй", ids.rowCount === 0);
    const vp = await c.query<{ p: number }>("select variant_price(pv.*) as p from product_variants pv where pv.id = $1", [f.variant]);
    check("anon variant_price (computed column) ажиллана", vp.rows[0].p === sale20, vp.rows[0]);
    const err = await errorOf(c, "select save_sale_event(null, '{}', '[]')");
    check("anon save_sale_event → permission denied", /permission denied/.test(err?.message ?? ""), err?.message);
    await c.query("reset role");
  });

  await scenario(c, "11. Slug дахин ашиглах, зогсоох, устгах", async () => {
    const old = await saveEvent(c, f, {
      slug: "black-friday",
      from: "now() - interval '3 hours'",
      to: "now() - interval '2 hours'",
    });
    await saveEvent(c, f, { slug: "black-friday", name: "Шинэ BF" });
    const r = await c.query<{ slug: string }>("select slug from sale_events where id = $1", [old]);
    check("дууссан хуучны slug архивлагдсан", /^black-friday-\d{4}/.test(r.rows[0].slug), r.rows[0]);
    const taken = await errorOf(
      c,
      `select save_sale_event(null, jsonb_build_object('slug','black-friday','name','X',
        'startsAt', now() + interval '9 hours', 'endsAt', now() + interval '10 hours', 'isActive', false), '[]')`,
    );
    check("явж буй slug давхардвал unique алдаа", /duplicate key|unique/i.test(taken?.message ?? ""), taken?.message);

    const sched = await saveEvent(c, f, {
      slug: "sched-x",
      from: "now() + interval '5 hours'",
      to: "now() + interval '6 hours'",
      items: [{ productId: f.other, pcts: {} }],
    });
    await c.query("select stop_sale_event($1)", [sched]);
    const s = await c.query("select is_active from sale_events where id = $1", [sched]);
    check("эхлээгүйг зогсоох → ноорог", s.rows[0].is_active === false);
    const delLive = await errorOf(c, "select delete_sale_event($1)", [old]);
    check("нийтэлсэн устгагдахгүй (NOT_DRAFT)", /NOT_DRAFT/.test(delLive?.message ?? ""), delLive?.message);
    const delDraft = await errorOf(c, "select delete_sale_event($1)", [sched]);
    check("ноорог устгагдана", delDraft === null, delDraft?.message);
  });

  await c.end();
  console.log(failed ? `\n✖ ${failed} шалгалт унасан.` : "\n✅ Бүх шалгалт амжилттай.");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
