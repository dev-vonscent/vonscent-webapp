import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPayment } from "@/lib/payments/qpay";
import type { QpayPaymentRow } from "@/lib/payments/qpay-types";
import { readInvoice } from "@/lib/payments/invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { notifyAdmin, tgEscape } from "@/lib/notify/telegram";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";
import { formatPrice, formatMl } from "@/lib/format";
import { deliveryDayOf, formatDeliveryDay } from "@/lib/time";
import { env } from "@/lib/env";

/**
 * Committing a payment.
 *
 * Two entry points on purpose:
 *
 *   - `verifyAndMarkOrderPaid` asks QPay whether the invoice was really paid
 *     and only then commits. Everything reachable from outside — the callback,
 *     the page's poller — goes through this.
 *   - `markOrderPaid` trusts its caller and is used by the mock-confirm
 *     endpoint (itself gated to mock mode) and by staff action.
 *
 * `mark_order_paid` (0016) is idempotent and does the real work: flips
 * `payment_status` to paid, moves `status` to **confirmed** — an order is not
 * confirmed until the money is in — commits the reserved ml and clears the
 * reserve hold.
 */

export type ConfirmOrderResult =
  | { ok: true; demo?: boolean; alreadyPaid?: boolean }
  | {
      ok: false;
      error:
        | "MISSING_ORDER"
        | "ORDER_NOT_FOUND"
        | "COMMIT_FAILED"
        | "NO_INVOICE"
        | "CHECK_FAILED"
        | "NOT_PAID"
        | "ORDER_CANCELLED";
    };

interface OrderPaymentRow {
  id: string;
  order_no: string;
  payment_status: string;
  qpay_invoice_id: string | null;
  total: number;
}

const SELECT = "id, order_no, payment_status, qpay_invoice_id, total";

async function loadOrder(
  supabase: SupabaseClient,
  column: "id" | "order_no",
  value: string,
): Promise<
  | { ok: true; order: OrderPaymentRow | null }
  | { ok: false; error: "CHECK_FAILED" }
> {
  const { data, error } = await supabase
    .from("orders")
    .select(SELECT)
    .eq(column, value)
    .maybeSingle();
  // A transient DB error must NOT read as "order not found" — the webhook maps
  // CHECK_FAILED to 5xx so QPay retries instead of giving up on a real payment.
  if (error) return { ok: false, error: "CHECK_FAILED" };
  return { ok: true, order: (data as OrderPaymentRow | null) ?? null };
}

/** Төлбөрийг хэн/юу баталсан — аудитын мөрөнд бичигдэнэ (0090). */
export type PaidSource = "qpay" | "manual" | "mock";

async function commit(
  supabase: SupabaseClient,
  order: OrderPaymentRow,
  source: PaidSource = "qpay",
  actor: string | null = null,
): Promise<ConfirmOrderResult> {
  const { error } = await callRpc(supabase, "mark_order_paid", {
    p_order: order.id,
    p_by: actor,
    p_source: source,
  });
  if (error) {
    // `mark_order_paid` (0073) refuses a cancelled order: its ml, points and
    // coupon were already given back, so committing would resurrect it. But
    // the money HAS arrived — the customer paid an invoice for an order they
    // (or the admin) cancelled in the meantime. Nothing in the schema can
    // record that, so it becomes a human task, loudly. Terminal for the
    // caller too: retrying will never succeed, so QPay must stop retrying.
    if (error.message.includes("ORDER_CANCELLED")) {
      // The bell in /admin is the durable channel; Telegram is best-effort.
      await supabase.from("admin_notifications").insert({
        kind: "payment_after_cancel",
        order_id: order.id,
        message:
          `Цуцлагдсан захиалга ${order.order_no}-д ${formatPrice(order.total)} ` +
          `төлбөр орж ирлээ. Захиалга сэргэхгүй — мөнгийг хэрэглэгчид гараар ` +
          `буцаана уу.`,
      });
      await notifyAdmin(
        `⚠️ <b>Цуцлагдсан захиалгад төлбөр орлоо</b> — ${tgEscape(order.order_no)}\n` +
          `💰 ${formatPrice(order.total)}\n` +
          `Захиалга цуцлагдсан тул автоматаар бүртгэгдсэнгүй. ` +
          `Мөнгийг хэрэглэгчид гараар буцаана уу.\n` +
          `🔗 ${env.siteUrl}/admin/orders/${order.id}`,
      );
      return { ok: false, error: "ORDER_CANCELLED" };
    }
    return { ok: false, error: "COMMIT_FAILED" };
  }

  // Админы Telegram дохио ЗӨВХӨН энд — төлбөр бодитоор орж, захиалга
  // баталгаажсаны дараа. Захиалга үүсэх мөчид (`api/orders`) юу ч явахгүй.
  await notifyPaid(supabase, order);
  // Урамшууллын купоныг энд ҮҮСГЭХГҮЙ: `orders_reward_coupon` trigger (0025,
  // 0041) нь `payment_status → 'paid'` болох мөчид `grant_reward_coupon`-ыг
  // өөрөө дуудна. Тэр нь `mark_order_paid`-ийн UPDATE-ийн дотор явдаг тул
  // энэ мөрөнд хүрэхэд купон аль хэдийн бэлэн — имэйл түүнийг уншина.
  await sendOrderCustomerEmail(order.id, "paid");
  return { ok: true };
}

/**
 * Төлбөр баталгаажсаны Telegram дохио — захиалсан барааны мэдээлэлтэйгээ.
 *
 * Админ дохиог хараад л шууд бэлтгэлд орох ёстой тул холбоо барих хүн, хаяг,
 * мөр бүр (брэнд, хэмжээ, тоо) болон төлбөрийн задаргаа нэг мессежинд багтана.
 * Best-effort: энэ query эсвэл илгээлт унасан ч төлбөрийн commit зогсохгүй —
 * `notifyAdmin` өөрөө throw хийхгүй, харин `orders` уншилт унавал зөвхөн
 * товч хувилбар явна.
 */
async function notifyPaid(
  supabase: SupabaseClient,
  order: OrderPaymentRow,
): Promise<void> {
  const link = `🔗 ${env.siteUrl}/admin/orders/${order.id}`;
  const head = `✅ <b>Төлбөр төлөгдлөө</b> — ${tgEscape(order.order_no)}\n`;

  const { data } = await supabase
    .from("orders")
    .select(
      "contact_name, contact_phone, ship_city, ship_district, ship_detail, note, payment_method, subtotal, shipping_fee, discount, loyalty_used, total, deliver_on, created_at",
    )
    .eq("id", order.id)
    .maybeSingle();
  const row = data as {
    contact_name: string | null;
    contact_phone: string | null;
    ship_city: string | null;
    ship_district: string | null;
    ship_detail: string | null;
    note: string | null;
    payment_method: string | null;
    subtotal: number;
    shipping_fee: number;
    discount: number;
    loyalty_used: number;
    total: number;
    deliver_on: string | null;
    created_at: string;
  } | null;
  if (!row) {
    await notifyAdmin(`${head}💰 ${formatPrice(order.total)}\n${link}`);
    return;
  }

  const { data: itemData } = await supabase
    .from("order_items")
    .select("product_name, brand, ml, qty, line_total, is_gift")
    .eq("order_id", order.id);
  const items = (itemData ?? []) as {
    product_name: string;
    brand: string | null;
    ml: number;
    qty: number;
    line_total: number;
    is_gift: boolean;
  }[];

  const itemList = items
    .map((i) => {
      const name = i.brand ? `${i.brand} — ${i.product_name}` : i.product_name;
      return (
        `• ${tgEscape(name)} ${formatMl(i.ml)} × ${i.qty}` +
        (i.is_gift ? " 🎁" : ` — ${formatPrice(i.line_total)}`)
      );
    })
    .join("\n");

  const address = [row.ship_city, row.ship_district, row.ship_detail]
    .filter(Boolean)
    .join(", ");
  // Задаргаанд утга нь 0 биш мөрийг л оруулна — ихэнх захиалгад хөнгөлөлт ч,
  // V point ч байхгүй, тэр мөрүүд зөвхөн дохиог уншихад хүндрүүлнэ.
  const breakdown = [
    `Бараа ${formatPrice(row.subtotal)}`,
    row.shipping_fee > 0 ? `хүргэлт ${formatPrice(row.shipping_fee)}` : null,
    row.discount > 0 ? `хөнгөлөлт −${formatPrice(row.discount)}` : null,
    row.loyalty_used > 0 ? `V point −${formatPrice(row.loyalty_used)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  await notifyAdmin(
    head +
      `👤 ${tgEscape(row.contact_name ?? "")} · ${tgEscape(row.contact_phone ?? "")}\n` +
      (address ? `📍 ${tgEscape(address)}\n` : "") +
      `🚚 ${tgEscape(formatDeliveryDay(deliveryDayOf(row)))}\n` +
      (itemList ? `\n${itemList}\n` : "") +
      (row.note ? `\n📝 ${tgEscape(row.note)}\n` : "") +
      `\n💰 <b>${formatPrice(row.total)}</b> · ` +
      `${row.payment_method === "qpay" ? "QPay" : "Банкны шилжүүлэг"}\n` +
      `${breakdown}\n` +
      link,
  );
}

/**
 * Mark an order paid without asking QPay. Callers must be trusted.
 *
 * `source`/`actor` нь аудитын мөрд очно: QPay-ээс батлагдсан төлбөр ба
 * ажилтны итгэл дээр тэмдэглэсэн төлбөр хоёр түүхэнд ялгарах ёстой (0090).
 */
export async function markOrderPaid(
  orderId: string,
  source: PaidSource = "manual",
  actor: string | null = null,
): Promise<ConfirmOrderResult> {
  if (!orderId) return { ok: false, error: "MISSING_ORDER" };
  const supabase = createAdminClient();
  if (!supabase) return { ok: true, demo: true };

  const loaded = await loadOrder(supabase, "id", orderId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (!loaded.order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (loaded.order.payment_status === "paid") {
    return { ok: true, alreadyPaid: true };
  }
  return commit(supabase, loaded.order, source, actor);
}

/**
 * Commit only after QPay confirms the invoice was paid **in full**.
 *
 * The partial-payment guard matters: QPay invoices are created with
 * `allow_partial: false`, but that is QPay's setting to change, not ours to
 * trust, and an under-payment must not confirm an order.
 */
export async function verifyAndMarkOrderPaid(
  orderId: string,
): Promise<ConfirmOrderResult> {
  if (!orderId) return { ok: false, error: "MISSING_ORDER" };
  const supabase = createAdminClient();
  if (!supabase) return { ok: true, demo: true };

  const loaded = await loadOrder(supabase, "id", orderId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  return verify(supabase, loaded.order);
}

/** Webhook path: QPay only knows the order number we put in `callback_url`. */
export async function verifyAndMarkOrderPaidByOrderNo(
  orderNo: string,
): Promise<ConfirmOrderResult> {
  if (!orderNo) return { ok: false, error: "MISSING_ORDER" };
  const supabase = createAdminClient();
  if (!supabase) return { ok: true, demo: true };

  const loaded = await loadOrder(supabase, "order_no", orderNo);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  return verify(supabase, loaded.order);
}

async function verify(
  supabase: SupabaseClient,
  order: OrderPaymentRow | null,
): Promise<ConfirmOrderResult> {
  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.payment_status === "paid") return { ok: true, alreadyPaid: true };
  if (!order.qpay_invoice_id) return { ok: false, error: "NO_INVOICE" };

  const check = await checkPayment(order.qpay_invoice_id);
  // null is "could not verify", not "unpaid" — treating a QPay outage as an
  // unpaid invoice would reject money that has already left the customer.
  if (!check) return { ok: false, error: "CHECK_FAILED" };

  // Compare against what the invoice actually asked for, not the order total.
  // The two are the same for a customer, and differ only for a staff test
  // order under QPAY_TEST_AMOUNT — where demanding the full total would leave
  // a genuinely paid invoice stuck as unpaid forever. It is also the more
  // honest check either way: the sum on the QR is the sum they agreed to.
  const invoice = await readInvoice(supabase, order.id);
  const due = invoice?.amount ?? order.total;
  if (!check.paid || check.paidAmount < due) {
    // Дутуу төлбөр нь «төлөөгүй»-ээс өөр: мөнгө ГАРСАН, гэхдээ захиалга
    // баталгаажихгүй. Чимээгүй `NOT_PAID` буцаавал нөөц дуусаж, захиалга
    // цуцлагдаж, хэн ч мөнгө орсныг мэдэхгүй үлдэнэ. Схемд «хэсэгчлэн
    // төлөгдсөн» гэсэн төлөв байхгүй тул үүнийг хүний ажил болгож дуудна.
    if (check.paidAmount > 0) {
      await notifyPartial(supabase, order, check.paidAmount, due);
    }
    return { ok: false, error: "NOT_PAID" };
  }
  // Илүү төлөлт нь захиалгыг зогсоохгүй — мөнгө бүрэн ирсэн тул баталгаажина,
  // харин зөрүүг буцаах нь мөн хүний ажил.
  if (check.paidAmount > due) {
    await notifyOverpaid(supabase, order, check.paidAmount, due);
  }
  // Гүйлгээний баримтыг commit-оос ӨМНӨ бичнэ: `commit` нь имэйл, Telegram,
  // оноо зэрэг олон зүйл хийдэг бөгөөд тэдний аль нэг нь унасан ч мөнгө
  // хаанаас ирснийг мөрдөх боломжтой байх ёстой.
  await recordPayments(supabase, order.id, check.rows);
  return commit(supabase, order);
}

/**
 * QPay-ийн PAID гүйлгээний мөрүүдийг хадгална (`qpay_payments`, 0089).
 *
 * `checkPayment` нь өмнө нь эдгээрийг нийлбэр болгоод хаядаг байсан тул
 * маргаантай төлбөрийг банкны хуулгатай тулгах түлхүүр үлддэггүй байв.
 *
 * `upsert`: энэ зам нь callback, хуудасны poller, tулгалтын cron гурваас
 * дуудагдах тул ижил гүйлгээ олон удаа ирнэ. `qpay_payment_id` нь primary
 * key учир давхардал үүсэхгүй.
 *
 * Best-effort: бичилт унасан ч төлбөрийн баталгаажуулалтыг зогсоохгүй —
 * мөнгө аль хэдийн ирсэн, захиалга батлагдах нь чухал.
 */
async function recordPayments(
  supabase: SupabaseClient,
  orderId: string,
  rows: QpayPaymentRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const values = rows
    .filter((r) => r.payment_id)
    .map((r) => ({
      qpay_payment_id: String(r.payment_id),
      order_id: orderId,
      // Мөнгө integer ₮ — QPay "10.00" гэж мөрөөр илгээдэг тул дугуйлна.
      amount: Math.round(Number(r.payment_amount ?? 0)),
      currency: r.payment_currency ?? null,
      paid_at: r.payment_date ?? null,
      wallet: r.payment_wallet ?? null,
      raw: r,
    }));
  if (values.length === 0) return;
  await supabase
    .from("qpay_payments")
    .upsert(values, { onConflict: "qpay_payment_id" });
}

/**
 * Дутуу төлбөр. `admin_notifications` нь удаан эдэлгээтэй суваг (админы
 * хонх), Telegram нь best-effort. Дохиог нэг захиалгад нэг л удаа бичнэ —
 * poller болон tулгалтын cron энэ замыг олон дахин туулна.
 */
async function notifyPartial(
  supabase: SupabaseClient,
  order: OrderPaymentRow,
  paid: number,
  due: number,
): Promise<void> {
  const inserted = await insertOnce(
    supabase,
    order.id,
    "partial_payment",
    `${order.order_no} захиалгад ${formatPrice(paid)} орж ирсэн ч ` +
      `${formatPrice(due)} шаардлагатай. Захиалга баталгаажаагүй — ` +
      `хэрэглэгчтэй холбогдож үлдэгдлийг нь авах эсвэл мөнгийг буцаана уу.`,
  );
  if (!inserted) return;
  await notifyAdmin(
    `⚠️ <b>Дутуу төлбөр</b> — ${tgEscape(order.order_no)}\n` +
      `💰 ${formatPrice(paid)} / ${formatPrice(due)}\n` +
      `🔗 ${env.siteUrl}/admin/orders/${order.id}`,
  );
}

/** Илүү төлөлт — захиалга баталгаажсан ч зөрүүг буцаах хэрэгтэй. */
async function notifyOverpaid(
  supabase: SupabaseClient,
  order: OrderPaymentRow,
  paid: number,
  due: number,
): Promise<void> {
  const inserted = await insertOnce(
    supabase,
    order.id,
    "overpayment",
    `${order.order_no} захиалгад ${formatPrice(paid)} орж ирсэн ч ` +
      `${formatPrice(due)} шаардлагатай байсан. Илүү гарсан ` +
      `${formatPrice(paid - due)}-г хэрэглэгчид буцаана уу.`,
  );
  if (!inserted) return;
  await notifyAdmin(
    `⚠️ <b>Илүү төлөлт</b> — ${tgEscape(order.order_no)}\n` +
      `💰 ${formatPrice(paid)} / ${formatPrice(due)}\n` +
      `🔗 ${env.siteUrl}/admin/orders/${order.id}`,
  );
}

/**
 * Нэг захиалга + нэг төрөлд нэг мэдэгдэл. Энэ замыг poller (15 секунд тутам)
 * ба tулгалтын cron (5 минут тутам) хоёр давтдаг тул хамгаалалтгүй бол
 * админы хонх нэг захиалгын улмаас хэдэн зуун мөрөөр дүүрнэ.
 */
async function insertOnce(
  supabase: SupabaseClient,
  orderId: string,
  kind: string,
  message: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("admin_notifications")
    .select("id")
    .eq("order_id", orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (data) return false;
  await supabase
    .from("admin_notifications")
    .insert({ kind, order_id: orderId, message });
  return true;
}
