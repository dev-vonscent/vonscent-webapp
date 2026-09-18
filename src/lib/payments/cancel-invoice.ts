import "server-only";

import { cancelInvoice } from "@/lib/payments/qpay";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Захиалга цуцлагдахад түүний QPay invoice-ыг ч хаана.
 *
 * **Яагаад.** `cancelInvoice` нь бичигдсэн байсан ч production-д хаанаас ч
 * дуудагддаггүй байв. Үр дүнд нь цуцлагдсан захиалгын QR **төлөгдөх
 * боломжтой хэвээр** үлддэг: хэрэглэгч 35 минутын дараа утсан дээрээ
 * нээлттэй үлдсэн QR-аа уншуулахад QPay төлбөрийг хүлээж авна. Дараа нь
 * `confirm-order`-ийн `ORDER_CANCELLED` салаа ажиллаж админд «мөнгийг
 * гараар буцаа» гэсэн ажил үүснэ — тэр бүхнийг нэг `DELETE /v2/invoice/{id}`
 * урьдчилан сэргийлэх байсан.
 *
 * **Best-effort.** Цуцлалт өөрөө аль хэдийн болсон (мл, оноо, купон буцсан);
 * QPay хариу өгөхгүй байгаа нь түүнийг буцаах шалтгаан биш. Алдааг залгина.
 *
 * **Идемпотент.** Цуцлагдсан invoice-ыг дахин цуцлахад QPay алдаа буцаана —
 * `cancelInvoice` түүнийг `false` болгон залгидаг тул давхар дуудлага аюулгүй.
 */
export async function cancelOrderInvoice(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("orders")
    .select("qpay_invoice_id, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as {
    qpay_invoice_id: string | null;
    payment_status: string;
  } | null;

  if (!order?.qpay_invoice_id) return;
  // Төлөгдсөн invoice-ыг цуцлах гэж оролдохгүй: мөнгө аль хэдийн орсон бол
  // энэ нь буцаалтын асуудал болохоос invoice-ийн асуудал биш.
  if (order.payment_status !== "unpaid") return;

  await cancelInvoice(order.qpay_invoice_id);
}
