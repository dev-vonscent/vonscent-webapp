import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPayment } from "@/lib/payments/qpay";
import { readInvoice } from "@/lib/payments/invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { notifyAdmin, tgEscape } from "@/lib/notify/telegram";
import { sendOrderCustomerEmail } from "@/lib/notify/customer-email";
import { formatPrice } from "@/lib/format";
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
        | "NOT_PAID";
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

async function commit(
  supabase: SupabaseClient,
  order: OrderPaymentRow,
): Promise<ConfirmOrderResult> {
  const { error } = await callRpc(supabase, "mark_order_paid", {
    p_order: order.id,
  });
  if (error) return { ok: false, error: "COMMIT_FAILED" };

  await notifyAdmin(
    `✅ <b>Төлбөр төлөгдлөө</b> — ${tgEscape(order.order_no)}\n` +
      `💰 ${formatPrice(order.total)}\n` +
      `🔗 ${env.siteUrl}/admin/orders/${order.id}`,
  );
  await sendOrderCustomerEmail(order.id, "paid");
  return { ok: true };
}

/** Mark an order paid without asking QPay. Callers must be trusted. */
export async function markOrderPaid(
  orderId: string,
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
  return commit(supabase, loaded.order);
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
    return { ok: false, error: "NOT_PAID" };
  }
  return commit(supabase, order);
}
