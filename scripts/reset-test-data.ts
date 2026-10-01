/**
 * Dev сангийн тест өгөгдлийн цэвэрлэгээ.
 *
 *   pnpm db:reset-test-data-dev              # хуурай: тоо харуулаад ROLLBACK
 *   pnpm db:reset-test-data-dev -- --apply   # бодитоор COMMIT
 *   ... -- --keep=VS-1043,VS-1050   # заасан захиалгыг (ба хэрэглэгчийнх нь
 *                                   # оноо, купон, хаяг, сэтгэгдлийг) үлдээнэ
 *
 * ⛔ ЗӨВХӨН DEV. Prod-ыг release-ийн өмнө (2026-10-01) нэг удаа цэвэрлэсэн;
 * түүнээс хойш prod-ын захиалга бүхэн жинхэнэ. Тиймээс prod команд байхгүй,
 * скрипт нь `DEV_PROJECT_REFS`-д байхгүй төсөл рүү холбогдохоос татгалзана
 * (хориглох биш ЗӨВШӨӨРӨХ жагсаалт — `.env.dev`-д prod URL санамсаргүй
 * орсон ч, prod төсөл солигдсон ч ажиллахгүй).
 *
 * Захиалга, тайлан, оноо, купон, сэтгэгдэл бүгд тэгээс эхэлнэ. Каталог (бараа, багц, зураг, үнэ,
 * таг, брэнд, тохиргоо) болон бүртгэлүүд ХӨНДӨГДӨХГҮЙ.
 *
 * Хадгалах ёстой гурван зүйл:
 *
 *   1. `restock_log`-ийн 'initial' мөр — эх савны өртөг (0111). Үүнийг
 *      устгавал тайлангийн «худалдан авалт» бүх бараанд 0 болох ба бараа
 *      засах хуудаснаас үнийг өөрчилсөн ч trigger нь ЗӨВХӨН байгаа мөрийг
 *      шинэчилдэг тул сэргэхгүй. Огноог нь энэ мөч болгоно — тайлан release-ээс
 *      шүүхэд эх савны зардал харагдана.
 *   2. `inventory.on_hand_ml` — эх савны бодит ml. Тест захиалгын түгжээ
 *      (`reserved_ml`) л тэглэгдэнэ; бодит тоог админ дараа нь нөөцийн
 *      цонхоор тааруулна.
 *   3. Бүртгэлүүд (auth.users, profiles) — оноо нь тэглэгдэнэ.
 *
 * Бүгд НЭГ transaction-д: аль нэг алхам унавал юу ч өөрчлөгдөхгүй.
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}
/** Цэвэрлэж болох Supabase төслүүд — зөвхөн dev. Prod-ыг ЭНД БҮҮ НЭМ. */
const DEV_PROJECT_REFS = ["zxvbgsnhldntcuswdpqm"];
if (!DEV_PROJECT_REFS.some((ref) => url.includes(ref))) {
  console.error(
    "✖ Энэ скрипт зөвхөн dev сан дээр ажиллана. Prod-ын өгөгдөл бүгд жинхэнэ — цэвэрлэхгүй.",
  );
  process.exit(1);
}
const apply = process.argv.includes("--apply");
/** `--keep=VS-1043,VS-1050` — release-ээс өмнөх ЖИНХЭНЭ захиалгууд. */
const keep = (process.argv.find((a) => a.startsWith("--keep="))?.slice(7) ?? "")
  .split(",")
  .map((x) => x.trim().toUpperCase())
  .filter(Boolean);

/** Өмнө/дараа нь тоолох хүснэгтүүд — цэвэрлэгээ ба хадгалагдах ёстойнх. */
const COUNTED = [
  "orders",
  "order_items",
  "order_status_history",
  "order_requests",
  "order_refund_accounts",
  "qpay_invoices",
  "qpay_payments",
  "admin_notifications",
  "coupons",
  "coupon_redemptions",
  "loyalty_ledger",
  "spin_wheel_spins",
  "reviews",
  "wishlists",
  "collection_wishlists",
  "addresses",
  "contact_messages",
  "newsletter_subscribers",
  "verify_mn_sessions",
  "phone_login_attempts",
  "rate_limits",
  "restock_log",
  // Хөндөгдөх ёсгүй — тоо нь өөрчлөгдвөл ямар нэг cascade буруу явсан.
  "products",
  "product_variants",
  "collections",
  "collection_items",
  "inventory",
  "profiles",
] as const;

/**
 * Дараалал нь FK-ийн дагуу: эхлээд захиалга руу заадаг, cascade-гүй мөрүүд,
 * дараа нь захиалга өөрөө (items, history, requests, refund accounts, qpay нь
 * cascade-аар хамт устна).
 */
const STEPS: { label: string; sql: string }[] = [
  {
    label: "Купоны ашиглалт",
    sql: `delete from coupon_redemptions
           where (order_id is null or order_id not in (select id from keep_orders))
             and (user_id is null or user_id not in (select id from keep_users))`,
  },
  {
    label: "Хүрдний эргүүлэлт",
    sql: "delete from spin_wheel_spins where user_id is null or user_id not in (select id from keep_users)",
  },
  {
    label: "V-point түүх",
    sql: "delete from loyalty_ledger where user_id is null or user_id not in (select id from keep_users)",
  },
  {
    label: "Купон (нийтийн + хувийн)",
    sql: `delete from coupons
           where (user_id is null or user_id not in (select id from keep_users))
             and (source_order_id is null or source_order_id not in (select id from keep_orders))`,
  },
  // reviews_rating_sync trigger нь бараа/багцын rating_avg, rating_count-ийг
  // мөр бүр дээр дахин бодно.
  {
    label: "Сэтгэгдэл (бараа + багц)",
    sql: "delete from reviews where user_id is null or user_id not in (select id from keep_users)",
  },
  {
    label: "Админы мэдэгдэл",
    sql: "delete from admin_notifications where order_id is null or order_id not in (select id from keep_orders)",
  },
  // orders_refresh_hot_tag (statement trigger) «Эрэлттэй» тагийг дахин бодно.
  {
    label: "Захиалга (+ cascade)",
    sql: "delete from orders where id not in (select id from keep_orders)",
  },
  {
    label: "Нөөцийн түүх ('initial'-ээс бусад)",
    sql: `delete from restock_log
           where reason <> 'initial'
             and (order_id is null or order_id not in (select id from keep_orders))`,
  },
  {
    label: "Эх савны өртгийн огноо → одоо",
    sql: "update restock_log set created_at = now() where reason = 'initial'",
  },
  {
    label: "V-point үлдэгдэл → 0",
    sql: `update profiles set loyalty_points = 0, pending_points = 0
           where (loyalty_points <> 0 or pending_points <> 0)
             and id not in (select id from keep_users)`,
  },
  // Үлдээх захиалга бүгд төлөгдсөн/цуцлагдсан (доор шалгана) — төлөгдөхөд
  // ml commit хийгдэж түгжээ суллагддаг (mark_order_paid) тул 0 зөв.
  {
    label: "Захиалгын түгжээ → 0",
    sql: "update inventory set reserved_ml = 0, is_sold_out = on_hand_ml <= 0",
  },
  {
    label: "Хүслийн жагсаалт (бараа)",
    sql: "delete from wishlists where user_id is null or user_id not in (select id from keep_users)",
  },
  {
    label: "Хүслийн жагсаалт (багц)",
    sql: "delete from collection_wishlists where user_id is null or user_id not in (select id from keep_users)",
  },
  {
    label: "Хүргэлтийн хаяг",
    sql: "delete from addresses where user_id is null or user_id not in (select id from keep_users)",
  },
  { label: "Холбоо барих мессеж", sql: "delete from contact_messages" },
  {
    label: "Мэдээллийн бүртгэл",
    sql: "delete from newsletter_subscribers where user_id is null or user_id not in (select id from keep_users)",
  },
  { label: "verify.mn сесс", sql: "delete from verify_mn_sessions" },
  { label: "Нэвтрэх оролдлого", sql: "delete from phone_login_attempts" },
  { label: "Rate limit", sql: "delete from rate_limits" },
  // Үлдсэн захиалгын дугаартай мөргөлдөхгүйн тулд хамгийн их дугаарын дараагаас.
  {
    label: "Захиалгын дугаар",
    sql: `select setval('order_no_seq', greatest(999, coalesce(
            (select max(substring(order_no from 4)::int) from orders), 999)))`,
  },
];

async function counts(c: Client) {
  const out: Record<string, number> = {};
  for (const t of COUNTED) {
    const r = await c.query<{ n: number }>(
      `select count(*)::int as n from public."${t}"`,
    );
    out[t] = r.rows[0].n;
  }
  return out;
}

async function main() {
  const c = await connectDb(url!);
  const host = new URL(url!).hostname;
  console.log(
    `\n${apply ? "⚠️  APPLY" : "ХУУРАЙ (rollback)"} — ${host}\n`,
  );

  try {
    await c.query("begin");
    const before = await counts(c);

    // Үлдээх захиалга ба тэдгээрийн хэрэглэгч — алхам бүр эдгээрийг тойрно.
    await c.query(
      `create temp table keep_orders on commit drop as
         select id, order_no, user_id, status::text, payment_status::text, contact_name, total
           from orders where order_no = any($1::text[])`,
      [keep],
    );
    await c.query(
      `create temp table keep_users on commit drop as
         select distinct user_id as id from keep_orders where user_id is not null`,
    );
    const kept = await c.query<{
      order_no: string; status: string; payment_status: string;
      contact_name: string; total: number; user_id: string | null;
    }>("select * from keep_orders order by order_no");
    const missing = keep.filter((k) => !kept.rows.some((r) => r.order_no === k));
    if (missing.length > 0) throw new Error(`Захиалга олдсонгүй: ${missing.join(", ")}`);
    // Төлөгдөөгүй идэвхтэй захиалга ml түгжсэн байдаг — түгжээг 0 болгох нь
    // түүнийг oversell руу түлхэнэ. Ийм захиалгыг үлдээхгүй.
    const open = kept.rows.filter(
      (r) => r.payment_status === "pending" && r.status !== "cancelled",
    );
    if (open.length > 0) {
      throw new Error(
        `Төлөгдөөгүй захиалга үлдээх боломжгүй: ${open.map((r) => r.order_no).join(", ")}`,
      );
    }
    if (kept.rows.length > 0) {
      console.log("  Үлдээх захиалга:");
      for (const r of kept.rows) {
        console.log(
          `    ${r.order_no}  ${r.contact_name}  ${r.total.toLocaleString()}₮  ${r.status}/${r.payment_status}  ${r.user_id ? "бүртгэлтэй" : "зочин"}`,
        );
      }
      console.log("");
    }

    for (const s of STEPS) {
      const r = await c.query(s.sql);
      const n = r.rowCount ?? 0;
      console.log(
        `  ${s.label.padEnd(36)} ${r.command === "SELECT" ? `→ VS-${Number(r.rows[0].setval) + 1}` : n}`,
      );
    }

    const after = await counts(c);
    const initial = await c.query<{ n: number; cost: string }>(
      `select count(*)::int as n, coalesce(sum(cost), 0)::text as cost
         from restock_log where reason = 'initial'`,
    );
    const reserved = await c.query<{ n: string }>(
      "select coalesce(sum(reserved_ml), 0)::text as n from inventory",
    );

    console.log("\n  хүснэгт                       өмнө → дараа");
    for (const t of COUNTED) {
      const mark = before[t] === after[t] ? " " : "•";
      console.log(
        `  ${mark} ${t.padEnd(28)} ${String(before[t]).padStart(5)} → ${after[t]}`,
      );
    }
    console.log(
      `\n  Эх савны өртөг: ${initial.rows[0].n} мөр, нийт ${Number(initial.rows[0].cost).toLocaleString()}₮`,
    );
    console.log(`  Түгжигдсэн ml: ${reserved.rows[0].n}`);

    // Каталог хөндөгдсөн бол (буруу cascade) commit хийхгүй.
    const untouched = [
      "products",
      "product_variants",
      "collections",
      "collection_items",
      "inventory",
      "profiles",
    ] as const;
    const broken = untouched.filter((t) => before[t] !== after[t]);
    if (broken.length > 0) {
      throw new Error(`Каталог/бүртгэл өөрчлөгдсөн: ${broken.join(", ")}`);
    }

    if (apply) {
      await c.query("commit");
      console.log("\n✓ COMMIT хийгдлээ.");
    } else {
      await c.query("rollback");
      console.log("\n✓ Хуурай ажиллалаа — юу ч өөрчлөгдөөгүй. Бодитоор: -- --apply");
    }
  } catch (e) {
    await c.query("rollback").catch(() => {});
    console.error("\n✖ ROLLBACK:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
