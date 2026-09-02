import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendEmail,
  renderEmail,
  STORE_INBOX,
  type EmailItem,
} from "@/lib/email";
import { env } from "@/lib/env";
import { formatPrice, formatMl } from "@/lib/format";

/**
 * Захиалгын имэйл мэдэгдэл — зөвхөн хоёр үед: төлбөр баталгаажихад ба
 * цуцлагдахад (өөр ямар ч төлөв солигдоход имэйл явахгүй — клиентийн шийдвэр).
 * Очих хаяг нь хэрэглэгчийн ӨӨРӨӨ бүртгүүлсэн имэйл (newsletter_subscribers,
 * данстай холбогдсон) — зочин болон имэйлээ бүртгүүлээгүй хэрэглэгчийг
 * чимээгүй алгасна. Имэйл бүрд unsubscribe линк явна (token-оор, нэвтрэлт
 * шаардахгүй).
 * Best-effort: илгээлт бүтэлгүйтсэн ч захиалгын урсгалыг хэзээ ч унагахгүй.
 */
export async function sendOrderCustomerEmail(
  orderId: string,
  kind: "paid" | "cancelled",
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("orders")
    .select(
      "order_no, subtotal, shipping_fee, discount, loyalty_used, total, user_id, payment_status",
    )
    .eq("id", orderId)
    .maybeSingle();
  const order = data as {
    order_no: string;
    subtotal: number;
    shipping_fee: number;
    discount: number;
    loyalty_used: number;
    total: number;
    user_id: string | null;
    payment_status: string;
  } | null;
  if (!order?.user_id) return; // guest — nowhere agreed to send to

  const { data: subData } = await supabase
    .from("newsletter_subscribers")
    .select("email, token, is_active")
    .eq("user_id", order.user_id)
    .maybeSingle();
  const sub = subData as {
    email: string;
    token: string;
    is_active: boolean;
  } | null;
  if (!sub || !sub.is_active) return;

  const unsubscribeUrl = `${env.siteUrl}/api/newsletter/unsubscribe?token=${sub.token}`;
  const footerNotes = [
    "Энэ мэдэгдлийг таны vonscent дээр бүртгүүлсэн имэйл рүү илгээв.",
  ];
  const ordersUrl = `${env.siteUrl}/account/orders`;

  const doc =
    kind === "paid"
      ? {
          preheader: `${order.order_no} — төлбөр баталгаажлаа`,
          heading: "Захиалга баталгаажлаа",
          paragraphs: [
            "Сайн байна уу! Таны захиалгын төлбөр амжилттай хүлээн авлаа.",
            `Захиалгын дугаар: ${order.order_no}. Захиалга тань маргааш 11:00 цагт хүргэлтэд гарна.`,
          ],
          items: await loadItems(supabase, orderId),
          lines: summaryLines(order),
          cta: { label: "Захиалгаа хянах", href: ordersUrl },
          footerNotes,
          unsubscribeUrl,
        }
      : {
          preheader: `${order.order_no} — захиалга цуцлагдлаа`,
          heading: "Захиалга цуцлагдлаа",
          paragraphs: [
            `Сайн байна уу! Таны ${order.order_no} дугаартай захиалга цуцлагдлаа.`,
            "Ашигласан оноо, купон автоматаар буцаагдсан.",
          ],
          lines: summaryLines(order),
          note:
            order.payment_status === "paid" ||
            order.payment_status === "refunded"
              ? "Төлбөр төлөгдсөн байсан тул бид тантай холбогдож мөнгийг тань буцаан шилжүүлнэ."
              : undefined,
          cta: { label: "Захиалгын түүх", href: ordersUrl },
          footerNotes,
          unsubscribeUrl,
        };

  const { html, text } = renderEmail(doc);
  await sendEmail({
    to: sub.email,
    subject:
      kind === "paid"
        ? `Захиалга баталгаажлаа — ${order.order_no}`
        : `Захиалга цуцлагдлаа — ${order.order_no}`,
    text,
    html,
    // Sent from no-reply@, which receives nothing — a customer who hits Reply
    // reaches the store rather than the void.
    replyTo: STORE_INBOX,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/** Захиалгын мөрүүд — уншиж чадахгүй бол мэдэгдлийг мөргүйгээр илгээнэ. */
async function loadItems(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  orderId: string,
): Promise<EmailItem[] | undefined> {
  const { data } = await supabase
    .from("order_items")
    .select("product_name, brand, ml, qty, line_total")
    .eq("order_id", orderId);
  const rows = data as
    | {
        product_name: string;
        brand: string;
        ml: number;
        qty: number;
        line_total: number;
      }[]
    | null;
  if (!rows?.length) return undefined;

  return rows.map((r) => ({
    name: r.brand ? `${r.brand} — ${r.product_name}` : r.product_name,
    meta: `${formatMl(r.ml)} × ${r.qty}`,
    amount: formatPrice(r.line_total),
  }));
}

function summaryLines(order: {
  subtotal: number;
  shipping_fee: number;
  discount: number;
  loyalty_used: number;
  total: number;
}) {
  const lines = [{ label: "Барааны дүн", value: formatPrice(order.subtotal) }];
  if (order.discount > 0) {
    lines.push({ label: "Хямдрал", value: `−${formatPrice(order.discount)}` });
  }
  if (order.loyalty_used > 0) {
    lines.push({
      label: "Оноо",
      value: `−${formatPrice(order.loyalty_used)}`,
    });
  }
  lines.push({
    label: "Хүргэлт",
    value: order.shipping_fee > 0 ? formatPrice(order.shipping_fee) : "Үнэгүй",
  });
  return [
    ...lines,
    { label: "Нийт", value: formatPrice(order.total), strong: true },
  ];
}
