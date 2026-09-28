import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { paymentLines } from "@/features/payment/api";
import type { OrderStatusView } from "./types";
import type { OrderStatus, PaymentStatusValue } from "@/lib/constants";

/**
 * Зочны захиалга сэргээх давхарга.
 *
 * Хоёр зам:
 *   - `getOrderStatusByToken` — имэйлээр ирсэн линк. Токен нь 128 бит
 *     санамсаргүй (`orders.pay_token`, 0068) тул тааж олох боломжгүй.
 *   - `findOrderByNoAndPhone` — имэйлээ алдсан хүн. `order_no` нь дараалсан
 *     sequence тул ГАНЦААРАА хангалтгүй: захиалгад бүртгүүлсэн утасны
 *     дугаартай хамт л таарна. Энэ нь SMS илгээхгүй, зардалгүй мэдлэгийн
 *     хүчин зүйл — verify.mn-ийн дуудалт бүр төлбөртэй тул зориуд сонгосон.
 *
 * `/pay/[token]`-ийн нууцлалын дүрэм энд ч мөрдөгдөнө: нэр, утас, хаяг
 * буцаахгүй. Линк дамжиж болно.
 */

interface OrderRow {
  id: string;
  order_no: string;
  status: OrderStatus;
  payment_status: PaymentStatusValue;
  created_at: string;
  deliver_on: string | null;
  subtotal: number;
  gross_subtotal: number | null;
  coupon_code: string | null;
  shipping_fee: number;
  discount: number;
  loyalty_used: number;
  total: number;
  pay_token: string | null;
}

const SELECT =
  "id, order_no, status, payment_status, created_at, deliver_on, subtotal, gross_subtotal, coupon_code, shipping_fee, discount, loyalty_used, total, pay_token";

export async function getOrderStatusByToken(
  token: string,
): Promise<OrderStatusView | null> {
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

  const [lines, { data: historyData }] = await Promise.all([
    paymentLines(supabase, order.id),
    supabase
      .from("order_status_history")
      .select("status, note, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);

  const history =
    (
      historyData as
        | { status: OrderStatus; note: string | null; created_at: string }[]
        | null
    )?.map((h) => ({
      status: h.status,
      note: h.note,
      createdAt: h.created_at,
    })) ?? [];

  const awaitingPayment =
    order.payment_status === "unpaid" &&
    order.status !== "cancelled" &&
    Boolean(order.pay_token);

  return {
    orderNo: order.order_no,
    status: order.status,
    paymentStatus: order.payment_status,
    createdAt: order.created_at,
    deliverOn: order.deliver_on,
    lines,
    subtotal: order.subtotal,
    grossSubtotal: order.gross_subtotal,
    couponCode: order.coupon_code,
    shippingFee: order.shipping_fee,
    discount: order.discount,
    loyaltyUsed: order.loyalty_used,
    total: order.total,
    // Токеныг зөвхөн төлөх боломжтой үед буцаана — төлөгдсөн захиалгын
    // хуудаснаас төлбөрийн линк рүү орох шалтгаан байхгүй.
    payToken: awaitingPayment ? order.pay_token : null,
    awaitingPayment,
    history,
  };
}

/**
 * Захиалгын дугаар + утсаар токен олох.
 *
 * Хоёулаа таарсан үед л токен буцаана. Аль нэг нь таарахгүй бол `null` —
 * дуудагч нь «байхгүй» ба «утас буруу» хоёрыг ялгаж харуулахгүй, эс тэгвээс
 * дараалсан дугаараар захиалгын оршин буйг тандах боломж нээгдэнэ.
 */
export async function findOrderByNoAndPhone(
  orderNo: string,
  phone: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("orders")
    .select("contact_phone, pay_token")
    .eq("order_no", orderNo.trim().toUpperCase())
    .maybeSingle();
  const row = data as {
    contact_phone: string | null;
    pay_token: string | null;
  } | null;
  if (!row?.pay_token || !row.contact_phone) return null;

  // Зөвхөн цифрээр харьцуулна: захиалгад "99112233" гэж хадгалагдсан ч
  // хэрэглэгч "9911-2233" гэж бичихийг зөвшөөрнө.
  const digits = (v: string) => v.replace(/\D/gu, "");
  if (digits(row.contact_phone) !== digits(phone)) return null;

  return row.pay_token;
}
