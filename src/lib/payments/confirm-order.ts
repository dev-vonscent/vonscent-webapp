import "server-only";

import { checkPayment } from "@/lib/payments/qpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";

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

/** Mark an order paid and commit reserved inventory (idempotent). */
export async function markOrderPaidByOrderNo(
  orderNo: string,
): Promise<ConfirmOrderResult> {
  if (!orderNo) return { ok: false, error: "MISSING_ORDER" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: true, demo: true };

  const { data } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("order_no", orderNo)
    .maybeSingle();
  const order = data as { id: string; payment_status: string } | null;

  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.payment_status === "paid") return { ok: true, alreadyPaid: true };

  const { error } = await callRpc(supabase, "mark_order_paid", {
    p_order: order.id,
  });
  if (error) return { ok: false, error: "COMMIT_FAILED" };

  return { ok: true };
}

/**
 * Webhook-safe variant: only marks the order paid after QPay itself confirms
 * the invoice was paid in full. `markOrderPaidByOrderNo` stays as the
 * trusting path for the dev-only mock confirm endpoint.
 */
export async function verifyAndMarkOrderPaidByOrderNo(
  orderNo: string,
): Promise<ConfirmOrderResult> {
  if (!orderNo) return { ok: false, error: "MISSING_ORDER" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: true, demo: true };

  // A transient DB error must NOT read as "order not found" — the webhook
  // maps CHECK_FAILED to 5xx so QPay retries instead of giving up.
  const { data, error: lookupError } = await supabase
    .from("orders")
    .select("id, payment_status, qpay_invoice_id, total")
    .eq("order_no", orderNo)
    .maybeSingle();
  if (lookupError) return { ok: false, error: "CHECK_FAILED" };
  const order = data as {
    id: string;
    payment_status: string;
    qpay_invoice_id: string | null;
    total: number;
  } | null;

  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.payment_status === "paid") return { ok: true, alreadyPaid: true };
  if (!order.qpay_invoice_id) return { ok: false, error: "NO_INVOICE" };

  const check = await checkPayment(order.qpay_invoice_id);
  if (!check) return { ok: false, error: "CHECK_FAILED" };
  if (!check.paid || check.paidAmount < order.total) {
    return { ok: false, error: "NOT_PAID" };
  }

  const { error } = await callRpc(supabase, "mark_order_paid", {
    p_order: order.id,
  });
  if (error) return { ok: false, error: "COMMIT_FAILED" };

  return { ok: true };
}
