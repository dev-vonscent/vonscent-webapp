import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail, sendEmail, STORE_INBOX } from "@/lib/email";
import { env } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import { resolveRecipient } from "@/lib/notify/customer-email";
import type { GiftCardRow } from "@/db/types";
import { formatGiftAmount } from "./lib";
import { recipientEmail } from "./email-docs";

/**
 * Бэлгийн картын имэйл (gift-cards-plan §6).
 *
 * Хүлээн авагчийн имэйлийг давхар явуулахгүй: `sent_at`-ийг илгээхээс ӨМНӨ
 * нөхцөлтэй update-ээр эзэмшинэ (webhook, reconcile, cron зэрэг дуудагдсан ч
 * нэг нь л ялна). Бүтэлгүйтвэл `sent_at` буцаж null — cron дахин оролдоно.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Автомат дахин оролдлогын дээд тоо (cron). Гараар илгээх нь тусдаа хязгаартай. */
export const MAX_AUTO_SENDS = 5;

async function logEvent(
  supabase: Admin,
  cardId: string,
  kind: "sent" | "send_failed" | "resent" | "email_changed",
  actor: string | null,
  data: Record<string, unknown> = {},
) {
  await supabase
    .from("gift_card_events")
    .insert({ gift_card_id: cardId, kind, actor, data });
}

/**
 * Нэг картыг хүлээн авагч руу. `manual` = худалдан авагч/админ гараар
 * (sent_at-аас үл хамааран); үгүй бол зөвхөн илгээгээгүй картыг эзэмшиж.
 */
async function sendToRecipient(
  supabase: Admin,
  card: GiftCardRow,
  opts: { manual: boolean; actor: string | null },
): Promise<boolean> {
  if (card.status !== "active" || !card.recipient_email) return false;
  const now = new Date().toISOString();

  if (!opts.manual) {
    const { data: claimed } = await supabase
      .from("gift_cards")
      .update({ sent_at: now, updated_at: now })
      .eq("id", card.id)
      .is("sent_at", null)
      .select("id");
    if (!(claimed as unknown[] | null)?.length) return false;
  }

  const { subject, doc } = recipientEmail(card, env.siteUrl);
  const { html, text } = renderEmail(doc);
  const ok = await sendEmail({
    to: card.recipient_email,
    subject,
    html,
    text,
    replyTo: STORE_INBOX,
  });

  await supabase
    .from("gift_cards")
    .update({
      sent_at: ok ? now : opts.manual ? card.sent_at : null,
      send_count: card.send_count + 1,
      last_send_error: ok ? null : "SEND_FAILED",
      updated_at: now,
    })
    .eq("id", card.id);
  await logEvent(
    supabase,
    card.id,
    ok ? (opts.manual ? "resent" : "sent") : "send_failed",
    opts.actor,
    { to: card.recipient_email },
  );
  return ok;
}

/** Худалдан авагчийн баримт — карт идэвхжлээ (+ «Өөрөө өгнө» бол код). */
async function sendBuyerReceipt(supabase: Admin, orderId: string, card: GiftCardRow) {
  const { data } = await supabase
    .from("orders")
    .select("order_no, total, user_id, contact_email")
    .eq("id", orderId)
    .maybeSingle();
  const order = data as {
    order_no: string;
    total: number;
    user_id: string | null;
    contact_email: string | null;
  } | null;
  if (!order) return;
  const to = await resolveRecipient(supabase, order);
  if (!to) return;
  const base = env.siteUrl.replace(/\/+$/u, "");
  const self = !card.recipient_email;
  const { html, text } = renderEmail({
    preheader: `${order.order_no} — бэлгийн карт идэвхжлээ`,
    hero: {
      src: `${base}/api/gift-cards/${card.token}/image`,
      alt: `Бэлгийн карт — ${formatGiftAmount(card.amount)}`,
      width: 504,
      height: 318,
    },
    heading: "Бэлгийн карт бэлэн боллоо",
    paragraphs: [
      self
        ? "Картаа холбоосоор хуваалцах эсвэл доорх кодыг хүлээн авагчдаа өгөөрэй."
        : `Карт ${card.recipient_email} хаяг руу код, зааврын хамт илгээгдлээ.`,
      "Хүлээн авагч кодоо оруулмагц картын дүн түүний дансанд V point болж орно.",
    ],
    lines: [
      { label: "Захиалга", value: order.order_no },
      { label: "Нийт төлсөн", value: formatPrice(order.total), strong: true },
    ],
    code: self ? { label: "Бэлгийн код", value: card.code } : undefined,
    cta: { label: "Картаа харах", href: `${base}/account/gift-cards` },
    footerNotes: [
      "Бэлгийн картыг буцаах боломжгүй.",
      to.unsubscribeUrl
        ? "Энэ мэдэгдлийг таны vonscent дээр бүртгүүлсэн имэйл рүү илгээв."
        : "Энэ мэдэгдлийг таны бүртгэлийн имэйл рүү илгээв.",
    ],
    unsubscribeUrl: to.unsubscribeUrl,
  });
  await sendEmail({
    to: to.email,
    subject: `Бэлгийн карт бэлэн боллоо — ${order.order_no}`,
    html,
    text,
    replyTo: STORE_INBOX,
  });
}

/**
 * Төлбөр баталгаажсаны дараа (`confirm-order.ts`): худалдан авагчийн баримт
 * + хүлээн авагч руу (товлоогүй бол). Best-effort — урсгалыг унагахгүй.
 */
export async function deliverGiftCardOrder(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const { data } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("order_id", orderId)
    .eq("status", "active");
  const cards = (data as GiftCardRow[] | null) ?? [];
  for (const card of cards) {
    const due = !card.send_at || new Date(card.send_at).getTime() <= Date.now();
    // Баримт нэг л удаа: хүлээн авагчийн илгээлтийг эзэмшсэн дуудлага, эсвэл
    // «Өөрөө өгнө» бол анх удаа (sent_at-гүй, send_count = 0).
    if (card.recipient_email && due) {
      const sent = await sendToRecipient(supabase, card, {
        manual: false,
        actor: null,
      });
      if (sent) await sendBuyerReceipt(supabase, orderId, card);
    } else if (!card.recipient_email && card.send_count === 0) {
      const { data: claimed } = await supabase
        .from("gift_cards")
        .update({ send_count: 1 })
        .eq("id", card.id)
        .eq("send_count", 0)
        .select("id");
      if ((claimed as unknown[] | null)?.length) {
        await sendBuyerReceipt(supabase, orderId, card);
      }
    }
  }
}

/** Cron: илгээгдээгүй (алдаа, товлосон) картууд. */
export async function retryPendingGiftCardEmails(): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase) return 0;
  const { data } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("status", "active")
    .is("sent_at", null)
    .not("recipient_email", "is", null)
    .lt("send_count", MAX_AUTO_SENDS)
    .or(`send_at.is.null,send_at.lte.${new Date().toISOString()}`)
    .limit(50);
  let n = 0;
  for (const card of (data as GiftCardRow[] | null) ?? []) {
    if (await sendToRecipient(supabase, card, { manual: false, actor: null })) n++;
  }
  return n;
}

export type ResendResult =
  | { ok: true; email: string }
  | { ok: false; error: "NOT_FOUND" | "NOT_ACTIVE" | "TOO_MANY" | "SEND_FAILED" };

/** Гараар илгээх/дахин илгээх дээд тоо (нэг картад). */
export const MAX_MANUAL_SENDS = 10;

/**
 * Худалдан авагч картаа имэйлээр илгээх/дахин илгээх, хаягийг засах
 * (gift-cards-plan §2.2, §6.4). Эрх: `buyerId` (route-ээс) эсвэл админ (null).
 */
export async function resendGiftCard(input: {
  cardId: string;
  email: string;
  buyerId: string | null;
  actor: string;
}): Promise<ResendResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "SEND_FAILED" };
  let query = supabase.from("gift_cards").select("*").eq("id", input.cardId);
  if (input.buyerId) query = query.eq("buyer_id", input.buyerId);
  const { data } = await query.maybeSingle();
  const card = data as GiftCardRow | null;
  if (!card) return { ok: false, error: "NOT_FOUND" };
  if (card.status !== "active") return { ok: false, error: "NOT_ACTIVE" };
  if (card.send_count >= MAX_MANUAL_SENDS) return { ok: false, error: "TOO_MANY" };

  const email = input.email.trim().toLowerCase();
  if (email !== card.recipient_email) {
    await supabase
      .from("gift_cards")
      .update({ recipient_email: email, updated_at: new Date().toISOString() })
      .eq("id", card.id);
    await logEvent(supabase, card.id, "email_changed", input.actor, {
      from: card.recipient_email,
      to: email,
    });
  }
  const ok = await sendToRecipient(
    supabase,
    { ...card, recipient_email: email },
    { manual: true, actor: input.actor },
  );
  return ok ? { ok: true, email } : { ok: false, error: "SEND_FAILED" };
}
