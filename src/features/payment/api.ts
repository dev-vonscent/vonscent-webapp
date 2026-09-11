import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getProductsByIds } from "@/features/products/api";
import { ensureInvoice } from "@/lib/payments/invoice";
import { isQpayMockMode } from "@/lib/payments/qpay";
import type { PaymentLine, PaymentView } from "./types";
import type { PaymentMethod } from "@/db/types";

/**
 * Resolve the payment page from its token.
 *
 * The token, not `order_no`, is the key: order numbers are a sequence
 * (`VS-1000`, `VS-1001`, …) so a page keyed by one would let anybody page
 * through other people's totals and QR codes. The view is also deliberately
 * narrow — no contact name, phone or address — because a payment link may be
 * forwarded to whoever is actually paying. The order's *lines* do belong here:
 * whoever is being asked for money has to see what the money is for.
 *
 * Reads run through the service-role client: `qpay_invoices` is staff-only
 * under RLS, and the token itself is the authorisation.
 */

interface OrderRow {
  id: string;
  order_no: string;
  user_id: string | null;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  loyalty_used: number;
  total: number;
  status: string;
  payment_method: PaymentMethod;
  payment_status: string;
  deliver_on: string | null;
}

interface ItemRow {
  product_id: string | null;
  product_name: string;
  brand: string;
  ml: number;
  qty: number;
  line_total: number;
  is_sample: boolean;
  collection_name: string | null;
}

const SELECT =
  "id, order_no, user_id, subtotal, shipping_fee, discount, loyalty_used, total, status, payment_method, payment_status, deliver_on";

const ITEM_SELECT =
  "product_id, product_name, brand, ml, qty, line_total, is_sample, collection_name";

/** The order's lines, with a product image where the product still exists. */
async function paymentLines(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  orderId: string,
): Promise<PaymentLine[]> {
  const { data } = await supabase
    .from("order_items")
    .select(ITEM_SELECT)
    .eq("order_id", orderId);
  const rows = (data as ItemRow[] | null) ?? [];
  if (rows.length === 0) return [];

  // Зураг нь `products`-д байгаа — order_items дээр хуулагддаггүй. Бараа
  // хожим устсан бол мөр зурагггүй л харагдана (нэр, дүн нь захиалга дээрээ).
  const ids = [...new Set(rows.map((r) => r.product_id).filter(Boolean))];
  const products = ids.length ? await getProductsByIds(ids as string[]) : [];
  const imageById = new Map(products.map((p) => [p.id, p.image?.url ?? null]));

  return rows.map((r) => ({
    name: r.product_name,
    brand: r.brand,
    ml: r.ml,
    qty: r.qty,
    lineTotal: r.line_total,
    isSample: r.is_sample,
    collectionName: r.collection_name,
    image: r.product_id ? (imageById.get(r.product_id) ?? null) : null,
  }));
}

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
  const lines = await paymentLines(supabase, order.id);

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
    lines,
    subtotal: order.subtotal,
    shippingFee: order.shipping_fee,
    discount: order.discount,
    loyaltyUsed: order.loyalty_used,
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
  /**
   * "yyyy-MM-dd" (UB). Төлбөр төлөгдөх мөчид `mark_order_paid` (0069) үүнийг
   * ахиулж болох тул төлсний дараа дахин унших нь шинэ өдрийг л буцаана.
   */
  deliverOn: string | null;
} | null> {
  if (!token) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("orders")
    .select("id, order_no, total, payment_status, deliver_on")
    .eq("pay_token", token)
    .maybeSingle();
  const row = data as {
    id: string;
    order_no: string;
    total: number;
    payment_status: string;
    deliver_on: string | null;
  } | null;
  if (!row) return null;
  return {
    id: row.id,
    orderNo: row.order_no,
    total: row.total,
    paid: row.payment_status === "paid",
    deliverOn: row.deliver_on,
  };
}
