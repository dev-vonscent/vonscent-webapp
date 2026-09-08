import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureInvoice } from "@/lib/payments/invoice";
import { isQpayMockMode } from "@/lib/payments/qpay";
import type { PaymentView } from "./types";
import type { PaymentMethod } from "@/db/types";

/**
 * Resolve the payment page from its token.
 *
 * The token, not `order_no`, is the key: order numbers are a sequence
 * (`VS-1000`, `VS-1001`, …) so a page keyed by one would let anybody page
 * through other people's totals and QR codes. The view is also deliberately
 * narrow — no contact name, phone or address — because a payment link may be
 * forwarded to whoever is actually paying.
 *
 * Reads run through the service-role client: `qpay_invoices` is staff-only
 * under RLS, and the token itself is the authorisation.
 */

interface OrderRow {
  id: string;
  order_no: string;
  user_id: string | null;
  total: number;
  status: string;
  payment_method: PaymentMethod;
  payment_status: string;
  deliver_on: string | null;
}

const SELECT =
  "id, order_no, user_id, total, status, payment_method, payment_status, deliver_on";

export async function getPaymentByToken(
  token: string,
): Promise<PaymentView | null> {
  if (!token) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("orders")
    .select(SELECT)
    .eq("pay_token", token)
    .maybeSingle();
  const order = data as OrderRow | null;
  if (!order) return null;

  const paid = order.payment_status === "paid";
  const cancelled = order.status === "cancelled";

  // An invoice is only worth having while the order can still be paid. Asking
  // QPay for one on a cancelled or already-paid order would create a live
  // invoice nobody should pay.
  let invoice: PaymentView["invoice"] = null;
  if (order.payment_method === "qpay" && !paid && !cancelled) {
    const ensured = await ensureInvoice(supabase, order);
    if (ensured) {
      invoice = {
        invoiceId: ensured.invoiceId,
        amount: ensured.amount,
        qrText: ensured.qrText,
        qrImage: ensured.qrImage,
        shortUrl: ensured.shortUrl,
        deeplinks: ensured.deeplinks,
      };
    }
  }

  return {
    orderNo: order.order_no,
    total: order.total,
    paymentMethod: order.payment_method,
    paid,
    cancelled,
    deliverOn: order.deliver_on,
    invoice,
    mock: isQpayMockMode(),
  };
}

/** The order id behind a token — for the status and confirm endpoints. */
export async function orderIdForToken(token: string): Promise<{
  id: string;
  orderNo: string;
  total: number;
  paid: boolean;
} | null> {
  if (!token) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("orders")
    .select("id, order_no, total, payment_status")
    .eq("pay_token", token)
    .maybeSingle();
  const row = data as {
    id: string;
    order_no: string;
    total: number;
    payment_status: string;
  } | null;
  if (!row) return null;
  return {
    id: row.id,
    orderNo: row.order_no,
    total: row.total,
    paid: row.payment_status === "paid",
  };
}
