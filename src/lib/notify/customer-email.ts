import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { formatPrice } from "@/lib/format";

/**
 * Захиалгын имэйл мэдэгдэл — зөвхөн хоёр үед: төлбөр баталгаажихад ба
 * цуцлагдахад. Очих хаяг нь хэрэглэгчийн ӨӨРӨӨ бүртгүүлсэн имэйл
 * (newsletter_subscribers, данстай холбогдсон) — бүртгэлгүй бол чимээгүй
 * алгасна. Имэйл бүрд unsubscribe линк явна (token-оор, нэвтрэлт шаардахгүй).
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
    .select("order_no, total, user_id, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as {
    order_no: string;
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

  const unsubscribe = `${env.siteUrl}/api/newsletter/unsubscribe?token=${sub.token}`;
  const footer =
    `\n\n—\nЭнэ мэдэгдлийг таны vonscent дээр бүртгүүлсэн имэйл рүү илгээв.\n` +
    `Мэдэгдэл авахаа болих: ${unsubscribe}`;

  if (kind === "paid") {
    await sendEmail({
      to: sub.email,
      subject: `Захиалга баталгаажлаа — ${order.order_no}`,
      text:
        `Сайн байна уу!\n\n` +
        `Таны ${order.order_no} дугаартай захиалгын төлбөр (${formatPrice(order.total)}) ` +
        `амжилттай баталгаажлаа. Захиалга тань маргааш 11:00 цагт хүргэлтэд гарна.\n\n` +
        `Захиалгаа хянах: ${env.siteUrl}/account/orders` +
        footer,
    });
  } else {
    await sendEmail({
      to: sub.email,
      subject: `Захиалга цуцлагдлаа — ${order.order_no}`,
      text:
        `Сайн байна уу!\n\n` +
        `Таны ${order.order_no} дугаартай захиалга цуцлагдлаа.\n` +
        (order.payment_status === "paid" || order.payment_status === "refunded"
          ? `Төлбөр төлөгдсөн байсан тул бид тантай холбогдож мөнгийг тань буцаан шилжүүлнэ. ` +
            `Ашигласан оноо, купон автоматаар буцаагдсан.\n`
          : `Ашигласан оноо, купон автоматаар буцаагдсан.\n`) +
        `\nЗахиалгын түүх: ${env.siteUrl}/account/orders` +
        footer,
    });
  }
}
