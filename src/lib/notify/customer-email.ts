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
import { RESERVE_TIMEOUT_MINUTES } from "@/lib/constants";
import { DISPATCH_HOUR, deliveryDayOf, formatDeliveryDay } from "@/lib/time";

/**
 * Захиалгын имэйл мэдэгдэл — гурван үед: захиалга үүсэхэд (`placed`, төлбөр
 * хүлээж буй), төлбөр баталгаажихад (`paid`), цуцлагдахад (`cancelled`).
 * Өөр ямар ч төлөв солигдоход имэйл явахгүй — клиентийн шийдвэр.
 *
 * **Хүлээн авагчийн дараалал** (`resolveRecipient`):
 *   1. `orders.contact_email` — захиалагч checkout дээр өөрөө бичсэн хаяг.
 *      Зочны хувьд захиалгаа дахин олох цорын ганц шууд зам тул энэ нь
 *      тэргүүн ээлжинд. Гүйлгээний имэйл учир unsubscribe линкгүй.
 *   2. `newsletter_subscribers.email` — данстай холбогдсон, өөрөө бүртгүүлсэн
 *      хаяг. Unsubscribe линктэй (хуучин зан төлөв хэвээр).
 *   3. Аль нь ч байхгүй бол чимээгүй алгасна.
 *
 * Best-effort: илгээлт бүтэлгүйтсэн ч захиалгын урсгалыг хэзээ ч унагахгүй.
 */
export async function sendOrderCustomerEmail(
  orderId: string,
  kind: "placed" | "paid" | "cancelled",
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("orders")
    .select(
      "order_no, subtotal, shipping_fee, discount, loyalty_used, total, user_id, payment_status, created_at, deliver_on, contact_email, pay_token, status",
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
    created_at: string;
    deliver_on: string | null;
    contact_email: string | null;
    pay_token: string | null;
    status: string;
  } | null;
  if (!order) return;

  const recipient = await resolveRecipient(supabase, order);
  if (!recipient) return;

  // Урамшууллын купон — `orders_reward_coupon` trigger (0025/0041) нь
  // төлбөр баталгаажих мөчид үүсгэчихсэн байдаг. Үүсгэх нь бүрэн ажиллаж
  // байсан ч ХЭЛЭХ хэсэг нь дутуу байв: купон зөвхөн дансны «Миний купон»
  // хэсэгт чимээгүй нэмэгдэж, хэн ч тэр хуудсыг зориуд шалгахгүй.
  const autoCoupon =
    kind === "paid" ? await loadAutoCoupon(supabase, orderId) : null;

  const { unsubscribeUrl } = recipient;
  const footerNotes = [
    unsubscribeUrl
      ? "Энэ мэдэгдлийг таны vonscent дээр бүртгүүлсэн имэйл рүү илгээв."
      : "Энэ мэдэгдлийг таны захиалга өгөхдөө бичсэн имэйл рүү илгээв.",
  ];
  // Зочин `/account/orders` руу орж чадахгүй тул төлбөрийн токенээр
  // ажилладаг нийтийн хуудас руу заана. Токенгүй (демо/хуучин мөр) үед л
  // дансны хуудас руу унана.
  const ordersUrl = order.pay_token
    ? `${env.siteUrl}/order/${order.pay_token}`
    : `${env.siteUrl}/account/orders`;
  const payUrl = order.pay_token
    ? `${env.siteUrl}/pay/${order.pay_token}`
    : null;

  const doc =
    kind === "placed"
      ? {
          preheader: `${order.order_no} — төлбөр хүлээгдэж байна`,
          heading: "Захиалга хүлээн авлаа",
          paragraphs: [
            "Сайн байна уу! Таны захиалгыг бүртгэн авлаа. Төлбөр хийгдмэгц " +
              "захиалга баталгаажина.",
            `Захиалгын дугаар: ${order.order_no}. Энэ дугаарыг хадгална уу — ` +
              `захиалгаа хэзээ ч «Захиалга хайх» хэсгээс олж болно.`,
            `Барааг тань ${RESERVE_TIMEOUT_MINUTES} минут нөөцөлж байна. ` +
              `Энэ хугацаанд төлбөр хийгдээгүй бол захиалга цуцлагдаж, бараа ` +
              `дэлгүүрт буцна.`,
          ],
          items: await loadItems(supabase, orderId),
          lines: summaryLines(order),
          cta: payUrl
            ? { label: "Төлбөрөө хийх", href: payUrl }
            : { label: "Захиалгаа харах", href: ordersUrl },
          footerNotes,
          unsubscribeUrl,
        }
      : kind === "paid"
        ? {
            preheader: `${order.order_no} — төлбөр баталгаажлаа`,
            heading: "Захиалга баталгаажлаа",
            paragraphs: [
              "Сайн байна уу! Таны захиалгын төлбөр амжилттай хүлээн авлаа.",
              `Захиалгын дугаар: ${order.order_no}. Захиалга тань ` +
                `${formatDeliveryDay(deliveryDayOf(order)).toLowerCase()} ` +
                `${DISPATCH_HOUR}:00 цагт хүргэлтэд гарна.`,
              ...(autoCoupon
                ? [
                    `🎁 Танд дараагийн захиалгад зориулсан ${autoCoupon.label} ` +
                      `купон нэмэгдлээ: ${autoCoupon.code}. ` +
                      `${autoCoupon.expiry} хүртэл хүчинтэй.`,
                  ]
                : []),
            ],
            items: await loadItems(supabase, orderId),
            lines: [
              {
                label: "Хүргэх өдөр",
                value: formatDeliveryDay(deliveryDayOf(order)),
              },
              ...summaryLines(order),
            ],
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
    to: recipient.email,
    subject:
      kind === "placed"
        ? `Захиалга хүлээн авлаа — ${order.order_no}`
        : kind === "paid"
          ? `Захиалга баталгаажлаа — ${order.order_no}`
          : `Захиалга цуцлагдлаа — ${order.order_no}`,
    text,
    html,
    // Sent from no-reply@, which receives nothing — a customer who hits Reply
    // reaches the store rather than the void.
    replyTo: STORE_INBOX,
    // Зөвхөн бүртгэлийн имэйл дээр: зочны гүйлгээний имэйлд unsubscribe
    // гэсэн ойлголт байхгүй (жагсаалтад ороогүй).
    headers: unsubscribeUrl
      ? {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });
}

/**
 * Хаашаа илгээхийг шийднэ. Захиалагчийн өөрийн бичсэн хаяг нь бүртгэлийн
 * хаягаас давуу: захиалгаа тэр хаягаар хүлээж байгаа бөгөөд зочны хувьд өөр
 * зам байхгүй. Бүртгэлийн хаяг руу явахдаа л unsubscribe линк хамт явна.
 */
async function resolveRecipient(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  order: { user_id: string | null; contact_email: string | null },
): Promise<{ email: string; unsubscribeUrl?: string } | null> {
  if (order.contact_email) return { email: order.contact_email };
  if (!order.user_id) return null; // зочин, имэйлээ бичээгүй

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("email, token, is_active")
    .eq("user_id", order.user_id)
    .maybeSingle();
  const sub = data as {
    email: string;
    token: string;
    is_active: boolean;
  } | null;
  if (!sub?.is_active) return null;
  return {
    email: sub.email,
    unsubscribeUrl: `${env.siteUrl}/api/newsletter/unsubscribe?token=${sub.token}`,
  };
}

/**
 * Энэ захиалгаас төрсөн урамшууллын купон. `coupons.source_order_id` дээрх
 * цорын ганц индекс (0025) тул нэг захиалгад дээд тал нь нэг.
 * Уншиж чадахгүй бол имэйл түүнгүйгээр явна.
 */
async function loadAutoCoupon(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  orderId: string,
): Promise<{ code: string; label: string; expiry: string } | null> {
  const { data } = await supabase
    .from("coupons")
    .select("code, type, value, ends_at")
    .eq("source_order_id", orderId)
    .maybeSingle();
  const row = data as {
    code: string;
    type: string;
    value: number;
    ends_at: string | null;
  } | null;
  if (!row) return null;
  return {
    code: row.code,
    label: row.type === "percent" ? `${row.value}%` : formatPrice(row.value),
    expiry: row.ends_at
      ? new Date(row.ends_at).toLocaleDateString("mn-MN")
      : "цуцлах хүртэл",
  };
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
    lines.push({
      label: "Хөнгөлөлт",
      value: `−${formatPrice(order.discount)}`,
    });
  }
  if (order.loyalty_used > 0) {
    lines.push({
      label: "V point",
      value: `−${formatPrice(order.loyalty_used)}`,
    });
  }
  lines.push({
    label: "Хүргэлт",
    value: order.shipping_fee > 0 ? formatPrice(order.shipping_fee) : "Үнэгүй",
  });
  return [
    ...lines,
    { label: "Нийт төлөх", value: formatPrice(order.total), strong: true },
  ];
}
