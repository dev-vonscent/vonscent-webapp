/**
 * Бэлгийн картын integration тест (0179, gift-cards-plan §4) — бодит Postgres.
 *
 *   pnpm db:test-gift-cards-dev      # зөвхөн .env.dev
 *
 * Сценари бүр `begin … rollback` дотор: туг (`gift_cards`)-ийг transaction
 * дотор асааж, юу ч үлдээхгүй.
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

const CODE_RE = /^VON-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✖ ${name}`, detail ?? "");
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

async function setFlag(c: Client, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ('gift_cards', $1)
     on conflict (key) do update set enabled = excluded.enabled`,
    [on],
  );
}

/** Алдааны мессежийг буцаана (savepoint — transaction эвдрэхгүй). */
async function errorOf(c: Client, sql: string, params: unknown[]) {
  await c.query("savepoint sp");
  try {
    await c.query(sql, params);
    await c.query("release savepoint sp");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint sp");
    return (e as Error).message;
  }
}

function cardInput(over: Record<string, unknown> = {}) {
  return {
    amount: 100000,
    design_id: "classic",
    recipient_name: "Сараа",
    message: "Төрсөн өдрийн мэнд!",
    from_name: "Болд",
    recipient_email: "test-recipient@example.com",
    contact_name: "Gift test",
    contact_phone: "99000000",
    ...over,
  };
}

async function place(c: Client, user: string, over: Record<string, unknown> = {}) {
  const { rows } = await c.query<{ r: { order_id: string; total: number } }>(
    "select place_gift_card_order($1, $2::jsonb) as r",
    [user, JSON.stringify(cardInput(over))],
  );
  return rows[0].r;
}

async function card(c: Client, orderId: string) {
  const { rows } = await c.query(
    "select * from gift_cards where order_id = $1",
    [orderId],
  );
  return rows[0];
}

async function redeem(c: Client, user: string, code: string | null, token?: string) {
  const { rows } = await c.query<{ r: Record<string, unknown> }>(
    "select redeem_gift_card($1, $2, $3) as r",
    [user, code, token ?? null],
  );
  return rows[0].r;
}

async function points(c: Client, user: string) {
  const { rows } = await c.query<{ loyalty_points: number; pending_points: number }>(
    "select loyalty_points, pending_points from profiles where id = $1",
    [user],
  );
  return rows[0];
}

async function main() {
  const c = await connectDb(url!);
  const users = await c.query<{ id: string }>(
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 2`,
  );
  if (users.rows.length < 2) throw new Error("Dev санд 2 хэрэглэгч хэрэгтэй.");
  const [buyer, recipient] = users.rows.map((r) => r.id);

  try {
    await scenario(c, "Туг хаалттай → юу ч үүсэхгүй", async () => {
      await setFlag(c, false);
      const err = await errorOf(c, "select place_gift_card_order($1, $2::jsonb)", [
        buyer,
        JSON.stringify(cardInput()),
      ]);
      check("FEATURE_DISABLED", err?.includes("FEATURE_DISABLED") ?? false, err);
      const r = await errorOf(c, "select redeem_gift_card($1, 'VON-AAAA-AAAA')", [
        recipient,
      ]);
      check("redeem FEATURE_DISABLED", r?.includes("FEATURE_DISABLED") ?? false, r);
      const { rows } = await c.query<{ n: number }>("select expire_gift_cards() as n");
      check("cron 0 буцаана", rows[0].n === 0);
    });

    await scenario(c, "Validation", async () => {
      await setFlag(c, true);
      const sql = "select place_gift_card_order($1, $2::jsonb)";
      const amt = await errorOf(c, sql, [buyer, JSON.stringify(cardInput({ amount: 150000 }))]);
      check("буруу дүн → GIFT_CARD_AMOUNT", amt?.includes("GIFT_CARD_AMOUNT") ?? false, amt);
      const des = await errorOf(c, sql, [buyer, JSON.stringify(cardInput({ design_id: "nope" }))]);
      check("буруу загвар → GIFT_CARD_DESIGN", des?.includes("GIFT_CARD_DESIGN") ?? false, des);
      const auth = await errorOf(c, sql, [null, JSON.stringify(cardInput())]);
      check("зочин → AUTH_REQUIRED", auth?.includes("AUTH_REQUIRED") ?? false, auth);
      const sendAt = await errorOf(c, sql, [
        buyer,
        JSON.stringify(
          cardInput({ recipient_email: null, send_at: new Date(Date.now() + 86400e3).toISOString() }),
        ),
      ]);
      check(
        "имэйлгүй товлолт → GIFT_CARD_SEND_AT_NEEDS_EMAIL",
        sendAt?.includes("GIFT_CARD_SEND_AT_NEEDS_EMAIL") ?? false,
        sendAt,
      );
    });

    await scenario(c, "Худалдах → төлөх → оноо болгох", async () => {
      await setFlag(c, true);
      const spendBefore = (
        await c.query<{ s: string }>("select user_lifetime_spend($1) as s", [buyer])
      ).rows[0].s;
      const before = await points(c, buyer);

      const placed = await place(c, buyer);
      check("нийт дүн = 100,000", placed.total === 100000, placed);
      const o1 = (
        await c.query("select * from orders where id = $1", [placed.order_id])
      ).rows[0];
      check("order_type = gift_card, pending", o1.order_type === "gift_card" && o1.status === "pending");
      let k = await card(c, placed.order_id);
      check("карт pending, код зөв хэлбэртэй", k.status === "pending" && CODE_RE.test(k.code), k);
      check("token 32 hex", /^[0-9a-f]{32}$/.test(k.token), k.token);

      const pre = await redeem(c, recipient, k.code);
      check("төлөгдөөгүй → NOT_ACTIVE", pre.reason === "NOT_ACTIVE", pre);

      await c.query("select mark_order_paid($1, null, 'mock')", [placed.order_id]);
      await c.query("select mark_order_paid($1, null, 'mock')", [placed.order_id]);
      const o2 = (
        await c.query("select * from orders where id = $1", [placed.order_id])
      ).rows[0];
      check("paid + delivered, deliver_on null",
        o2.payment_status === "paid" && o2.status === "delivered" && o2.deliver_on === null, o2);
      k = await card(c, placed.order_id);
      const days = (new Date(k.expires_at).getTime() - Date.now()) / 86400e3;
      check("карт active, ~1 жил", k.status === "active" && days > 364 && days < 367, k);

      const earn = await c.query(
        "select delta, released, available_at from loyalty_ledger where order_id = $1 and reason = 'earn'",
        [placed.order_id],
      );
      check("earn нэг л мөр (idempotent)", earn.rows.length <= 1, earn.rows);
      if (earn.rows.length === 1) {
        const lock = (new Date(earn.rows[0].available_at).getTime() - Date.now()) / 86400e3;
        check("earn түгжигдсэн, ~7 хоног", !earn.rows[0].released && lock > 6.9 && lock < 7.1, earn.rows[0]);
        const mid = await points(c, buyer);
        check("pending_points өссөн",
          mid.pending_points === before.pending_points + earn.rows[0].delta, { before, mid });
      }

      const spendAfter = (
        await c.query<{ s: string }>("select user_lifetime_spend($1) as s", [buyer])
      ).rows[0].s;
      check("зэрэглэлийн зарцуулалт өөрчлөгдөөгүй", spendAfter === spendBefore, { spendBefore, spendAfter });

      const spins = await c.query("select 1 from spin_wheel_credits where order_id = $1", [placed.order_id]);
      check("хүрдний эрх олгоогүй", spins.rows.length === 0);
      const cps = await c.query("select 1 from coupons where source_order_id = $1", [placed.order_id]);
      check("автомат купон олгоогүй", cps.rows.length === 0);

      const rBefore = await points(c, recipient);
      const loose = k.code.replace(/-/g, " ").toLowerCase();
      const r1 = await redeem(c, recipient, loose);
      check("оноо болгосон (жижиг үсэг, зайтай код)", r1.ok === true && r1.points === 100000, r1);
      const rAfter = await points(c, recipient);
      check("хүлээн авагчийн оноо +100,000",
        rAfter.loyalty_points === rBefore.loyalty_points + 100000, { rBefore, rAfter });
      const led = await c.query(
        "select delta from loyalty_ledger where user_id = $1 and reason = 'gift_card' and gift_card_id = $2",
        [recipient, k.id],
      );
      check("ledger gift_card мөр", led.rows.length === 1 && led.rows[0].delta === 100000, led.rows);

      if (earn.rows.length === 1) {
        const rel = await c.query(
          "select released from loyalty_ledger where order_id = $1 and reason = 'earn'",
          [placed.order_id],
        );
        check("худалдан авагчийн оноо нээгдсэн", rel.rows[0].released === true);
      }

      const r2 = await redeem(c, buyer, null, k.token);
      check("давхар → ALREADY_REDEEMED", r2.reason === "ALREADY_REDEEMED", r2);
      const nf = await redeem(c, recipient, "VON-2222-2222");
      check("байхгүй код → NOT_FOUND", nf.reason === "NOT_FOUND", nf);

      // delivered → shipping → cancelled тойруу зам ч хаалттай.
      const back = await errorOf(
        c,
        "select update_order_status($1, 'shipping', 'test', null)",
        [placed.order_id],
      );
      check("delivered → shipping → GIFT_CARD_NOT_REFUNDABLE",
        back?.includes("GIFT_CARD_NOT_REFUNDABLE") ?? false, back);
      const refund = await errorOf(
        c,
        "update orders set payment_status = 'refunded' where id = $1",
        [placed.order_id],
      );
      check("refunded → GIFT_CARD_NOT_REFUNDABLE",
        refund?.includes("GIFT_CARD_NOT_REFUNDABLE") ?? false, refund);
    });

    await scenario(c, "Төлөгдөөгүй цуцлалт → void", async () => {
      await setFlag(c, true);
      const placed = await place(c, buyer, { amount: 200000 });
      await c.query("select update_order_status($1, 'cancelled', 'test', null)", [placed.order_id]);
      const k = await card(c, placed.order_id);
      check("карт void", k.status === "void" && k.void_reason === "unpaid", k);
      const r = await redeem(c, recipient, k.code);
      check("void → VOID", r.reason === "VOID", r);
    });

    await scenario(c, "Төлөгдөөгүй → «Дараа захиалах», сэргээхгүй", async () => {
      await setFlag(c, true);
      const placed = await place(c, buyer, {
        amount: 100000,
        draft: { amount: 100000, designId: "classic", recipientName: "Сараа", fromName: "Болд", delivery: "self" },
      });
      await c.query("select abandon_unpaid_order($1, true, 'test', null)", [placed.order_id]);
      const { rows: saved } = await c.query<{ id: string | null }>(
        "select (select id from saved_checkouts where source_order_id = $1) as id",
        [placed.order_id],
      );
      check("«Дараа захиалах»-д хадгалсан", saved[0].id !== null, saved[0]);
      const { rows: gc } = await c.query<{ gift_card: Record<string, unknown> }>(
        "select gift_card from saved_checkouts where source_order_id = $1",
        [placed.order_id],
      );
      check("маягтын ноорог хадгалагдсан", gc[0]?.gift_card?.recipientName === "Сараа", gc[0]);
      const k = await card(c, placed.order_id);
      check("карт void", k.status === "void", k);
      const { rows: ev } = await c.query<{ n: number }>(
        "select count(*)::int as n from gift_card_events where gift_card_id = $1 and kind = 'voided'",
        [k.id],
      );
      check("voided түүхэнд", ev[0].n === 1, ev[0]);
      const restore = await errorOf(
        c,
        "select update_order_status($1, 'pending', 'restore', null)",
        [placed.order_id],
      );
      check("сэргээхийг хориглосон", restore?.includes("GIFT_CARD_ORDER_CANCELLED") ?? false, restore);
    });

    await scenario(c, "Хугацаа дуусах", async () => {
      await setFlag(c, true);
      const placed = await place(c, buyer, { amount: 300000 });
      await c.query("select mark_order_paid($1, null, 'mock')", [placed.order_id]);
      const k = await card(c, placed.order_id);
      await c.query("update gift_cards set expires_at = now() - interval '1 minute' where id = $1", [k.id]);
      const { rows } = await c.query<{ n: number }>("select expire_gift_cards() as n");
      check("cron дуусгасан", rows[0].n >= 1);
      const r = await redeem(c, recipient, k.code);
      check("EXPIRED", r.reason === "EXPIRED", r);
    });
  } finally {
    await c.end();
  }

  console.log(failed === 0 ? "\n✅ Бүгд амжилттай." : `\n✖ ${failed} алдаа.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
