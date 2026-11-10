import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail, sendEmail, STORE_INBOX } from "@/lib/email";
import { env } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import { resolveRecipient } from "@/lib/notify/customer-email";
import { notifyAdmin, tgEscape } from "@/lib/notify/telegram";
import type { GiftCardRow } from "@/db/types";
import { formatGiftAmount } from "./lib";
import {
  formatSendAt,
  recipientEmail,
  reminderEmail,
  type GiftReminderKind,
} from "./email-docs";

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

/**
 * Resend-ийн үнэгүй багц: өдөрт 100, сард 3,000 имэйл, секундэд ~2 хүсэлт
 * (сайтын БҮХ имэйлтэй хуваалцана). Тиймээс:
 *   - нэг cron-д хүлээн авагчийн имэйл ≤ `CRON_SEND_BATCH`, баримт ≤
 *     `CRON_RECEIPT_BATCH`;
 *   - сануулга (үүрэг биш) өдөрт ≤ `REMINDERS_PER_DAY`;
 *   - дараалсан илгээлтийн хооронд ≥ `SEND_GAP_MS`.
 */
const CRON_SEND_BATCH = 20;
const CRON_RECEIPT_BATCH = 10;
const REMINDERS_PER_DAY = 30;
const SEND_GAP_MS = 600;

let lastSendAt = 0;
/** Нэг instance доторх дараалсан илгээлтийг Resend-ийн хурдад тааруулна. */
async function pacedSend(params: Parameters<typeof sendEmail>[0]) {
  const wait = lastSendAt + SEND_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSendAt = Date.now();
  return sendEmail(params);
}

function isExpired(card: Pick<GiftCardRow, "expires_at">, now = Date.now()) {
  return card.expires_at !== null && new Date(card.expires_at).getTime() <= now;
}

async function logEvent(
  supabase: Admin,
  cardId: string,
  kind:
    | "sent"
    | "send_failed"
    | "resent"
    | "email_changed"
    | "reminded"
    | "buyer_notified",
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
  // Хугацаа өнгөрсөн ч өдрийн cron (`expire_gift_cards`) хараахан
  // тэмдэглээгүй карт — кодыг илгээхгүй.
  if (card.status !== "active" || !card.recipient_email || isExpired(card)) {
    return false;
  }
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
  const ok = await pacedSend({
    to: card.recipient_email,
    subject,
    html,
    text,
    replyTo: STORE_INBOX,
  });

  let result = supabase
    .from("gift_cards")
    .update({
      sent_at: ok ? now : opts.manual ? card.sent_at : null,
      send_count: card.send_count + 1,
      last_send_error: ok ? null : "SEND_FAILED",
      updated_at: now,
    })
    .eq("id", card.id);
  // Автомат: зөвхөн ӨӨРИЙН эзэмшлийг буцаана — хооронд нь худалдан авагч
  // гараар амжилттай илгээсэн бол түүнийг дарж `sent_at`-ийг null болгохгүй.
  if (!opts.manual) result = result.eq("sent_at", now);
  await result;
  if (!ok && !opts.manual && card.send_count + 1 >= MAX_AUTO_SENDS) {
    await alertSendGaveUp(supabase, card);
  }
  await logEvent(
    supabase,
    card.id,
    ok ? (opts.manual ? "resent" : "sent") : "send_failed",
    opts.actor,
    { to: card.recipient_email },
  );
  return ok;
}

/**
 * Автомат илгээлт `MAX_AUTO_SENDS` удаа бүтэлгүйтэв — мөнгө төлөгдсөн бэлэг
 * хүлээн авагчид хүрээгүй тул хүний ажил (§6.4). Хонх (durable) + Telegram.
 */
async function alertSendGaveUp(supabase: Admin, card: GiftCardRow) {
  const message =
    `Бэлгийн карт ${card.code} (${formatGiftAmount(card.amount)}) ` +
    `${card.recipient_email} руу ${MAX_AUTO_SENDS} удаа илгээгдсэнгүй. ` +
    `Хаягийг шалгаад «Дахин илгээх»-ээр илгээнэ үү.`;
  await supabase.from("admin_notifications").insert({
    kind: "gift_card_send_failed",
    order_id: card.order_id,
    message,
  });
  await notifyAdmin(
    `⚠️ <b>Бэлгийн карт илгээгдсэнгүй</b> — ${tgEscape(card.code)}\n` +
      `${tgEscape(card.recipient_email ?? "")}\n` +
      `🔗 ${env.siteUrl}/admin/gift-cards/${card.id}`,
  );
}

/**
 * Худалдан авагчийн баримт — карт идэвхжлээ (+ «Өөрөө өгнө» бол код).
 * `true` = дууссан (илгээсэн, эсвэл илгээх хаяггүй); `false` = дахин оролдоно.
 */
async function sendBuyerReceipt(
  supabase: Admin,
  orderId: string,
  card: GiftCardRow,
): Promise<boolean> {
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
  if (!order) return true;
  const to = await resolveRecipient(supabase, order);
  if (!to) return true;
  const base = env.siteUrl.replace(/\/+$/u, "");
  const self = !card.recipient_email;
  const scheduled =
    !self && card.send_at !== null && new Date(card.send_at).getTime() > Date.now();
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
        : scheduled
          ? `Карт ${card.recipient_email} хаяг руу ${formatSendAt(card.send_at!)}-д код, зааврын хамт илгээгдэнэ.`
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
  return pacedSend({
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
    if (card.recipient_email && due) {
      await sendToRecipient(supabase, card, { manual: false, actor: null });
    }
    await notifyBuyer(supabase, card);
  }
}

/**
 * Худалдан авагчийн баримт НЭГ удаа (0180 `buyer_notified_at`-ийн эзэмшил)
 * — шууд, товлосон, «Өөрөө өгнө» аль ч үед төлбөр орсон даруйд. Илгээж
 * чадаагүй бол эзэмшлийг буцааж, cron дахин оролдоно (self картад код
 * агуулдаг тул алдагдах ёсгүй).
 */
async function notifyBuyer(supabase: Admin, card: GiftCardRow): Promise<boolean> {
  const at = new Date().toISOString();
  const { data: claimed } = await supabase
    .from("gift_cards")
    .update({ buyer_notified_at: at })
    .eq("id", card.id)
    .is("buyer_notified_at", null)
    .select("id");
  if (!(claimed as unknown[] | null)?.length) return false;
  const done = await sendBuyerReceipt(supabase, card.order_id, card).catch(
    () => false,
  );
  if (!done) {
    await supabase
      .from("gift_cards")
      .update({ buyer_notified_at: null })
      .eq("id", card.id)
      .eq("buyer_notified_at", at);
    return false;
  }
  await logEvent(supabase, card.id, "buyer_notified", null);
  return true;
}

/** Cron: илгээгдээгүй (алдаа, товлосон) картууд. */
export async function retryPendingGiftCardEmails(): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase) return 0;
  const nowIso = new Date().toISOString();

  // Эзэмшээд (sent_at) дуусгаж амжаагүй — function тасарсан. Амжилт ч,
  // алдаа ч `send_count`-ийг нэмдэг тул 0 хэвээр + 15 минутаас хуучин =
  // гацсан эзэмшил: буцааж cron-д өгнө.
  await supabase
    .from("gift_cards")
    .update({ sent_at: null })
    .eq("status", "active")
    .eq("send_count", 0)
    .not("recipient_email", "is", null)
    .lt("sent_at", new Date(Date.now() - 15 * 60e3).toISOString());

  const { data } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("status", "active")
    .is("sent_at", null)
    .not("recipient_email", "is", null)
    .lt("send_count", MAX_AUTO_SENDS)
    .gt("expires_at", nowIso)
    .or(`send_at.is.null,send_at.lte.${nowIso}`)
    .order("created_at")
    .limit(CRON_SEND_BATCH);
  let n = 0;
  for (const card of (data as GiftCardRow[] | null) ?? []) {
    if (await sendToRecipient(supabase, card, { manual: false, actor: null })) n++;
  }
  return n;
}

/** Cron: илгээж чадаагүй худалдан авагчийн баримт (`buyer_notified_at` null). */
export async function retryBuyerReceipts(): Promise<number> {
  const supabase = createAdminClient();
  if (!supabase) return 0;
  // 2 минут — төлбөрийн дараах `deliverGiftCardOrder`-той уралдахгүй.
  const { data } = await supabase
    .from("gift_cards")
    .select("*")
    .in("status", ["active", "redeemed"])
    .is("buyer_notified_at", null)
    .lt("issued_at", new Date(Date.now() - 2 * 60e3).toISOString())
    .order("issued_at")
    .limit(CRON_RECEIPT_BATCH);
  let n = 0;
  for (const card of (data as GiftCardRow[] | null) ?? []) {
    if (await notifyBuyer(supabase, card)) n++;
  }
  return n;
}

export type ResendResult =
  | { ok: true; email: string; scheduled?: string }
  | {
      ok: false;
      error: "NOT_FOUND" | "NOT_ACTIVE" | "TOO_MANY" | "TOO_SOON" | "SEND_FAILED";
    };

/** Гараар илгээх дээд тоо (нэг картад, автомат оролдлогыг тоолохгүй). */
export const MAX_MANUAL_SENDS = 5;
/** Нэг картыг гараар дахин илгээх хоорондын зай. */
export const MANUAL_SEND_COOLDOWN_MIN = 5;

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
  if (card.status !== "active" || isExpired(card)) {
    return { ok: false, error: "NOT_ACTIVE" };
  }

  // Гараар илгээсэн түүх (resent) — тоо ба хоорондын зай.
  const { data: manual } = await supabase
    .from("gift_card_events")
    .select("created_at")
    .eq("gift_card_id", card.id)
    .eq("kind", "resent")
    .order("created_at", { ascending: false });
  const sends = (manual as { created_at: string }[] | null) ?? [];
  if (sends.length >= MAX_MANUAL_SENDS) return { ok: false, error: "TOO_MANY" };
  const last = sends[0] ? new Date(sends[0].created_at).getTime() : 0;
  if (Date.now() - last < MANUAL_SEND_COOLDOWN_MIN * 60e3) {
    return { ok: false, error: "TOO_SOON" };
  }

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
  // Товлосон, хараахан илгээгээгүй карт: хаягийг л засна — сюрприз нь
  // товлосон өдөртөө (cron) очно.
  if (
    !card.sent_at &&
    card.send_at &&
    new Date(card.send_at).getTime() > Date.now()
  ) {
    return { ok: true, email, scheduled: card.send_at };
  }
  const ok = await sendToRecipient(
    supabase,
    { ...card, recipient_email: email },
    { manual: true, actor: input.actor },
  );
  return ok ? { ok: true, email } : { ok: false, error: "SEND_FAILED" };
}

const REMINDER_COLUMN: Record<GiftReminderKind, string> = {
  unused: "reminded_unused_at",
  expiry_30: "reminded_expiry_30_at",
  expiry_7: "reminded_expiry_7_at",
};

/** Сануулга шөнө очихгүй — УБ 09:00–20:00. */
function isDaytimeUb(now = new Date()): boolean {
  const hour = Number(
    now.toLocaleString("en-GB", {
      timeZone: "Asia/Ulaanbaatar",
      hour: "2-digit",
      hour12: false,
    }),
  );
  return hour >= 9 && hour < 20;
}

/**
 * Cron: хүлээн авагч руу илгээгдсэн, ашиглагдаагүй картад сануулга
 * (gift-cards-plan §6.3). Төрөл бүр нэг удаа — баганыг илгээхээс ӨМНӨ
 * эзэмшинэ; бүтэлгүйтвэл эзэмшлийг буцааж дараагийн cron-д (өдрийн төсөв
 * `REMINDERS_PER_DAY` дотор).
 *
 *   unused    — илгээснээс 7 хоног, хугацаа 30+ хоног үлдсэн
 *   expiry_30 — хугацаа дуусахад 8–30 хоног
 *   expiry_7  — хугацаа дуусахад ≤7 хоног
 */
export async function sendGiftCardReminders(now = new Date()): Promise<number> {
  if (!isDaytimeUb(now)) return 0;
  const supabase = createAdminClient();
  if (!supabase) return 0;
  const day = 86400e3;
  const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();

  // Өдрийн төсөв (Resend-ийн үнэгүй багц) — амжилтгүй оролдлого ч тоологдоно.
  const { count: used } = await supabase
    .from("gift_card_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "reminded")
    .gte("created_at", iso(-day));
  let budget = REMINDERS_PER_DAY - (used ?? 0);
  if (budget <= 0) return 0;

  // Хүлээн авагчид очоод ≥1 хоног болсон — хожуу илгээсэн картад «30
  // хоногийн дараа дуусна» сануулга бэлэгтэйгээ зэрэг очихгүй.
  const base = () =>
    supabase
      .from("gift_cards")
      .select("*")
      .eq("status", "active")
      .not("recipient_email", "is", null)
      .lte("sent_at", iso(-day))
      .limit(budget);

  const sets: [GiftReminderKind, PromiseLike<{ data: unknown }>][] = [
    [
      "unused",
      base()
        .is("reminded_unused_at", null)
        .lte("sent_at", iso(-7 * day))
        .gt("expires_at", iso(30 * day)),
    ],
    [
      "expiry_30",
      base()
        .is("reminded_expiry_30_at", null)
        .gt("expires_at", iso(7 * day))
        .lte("expires_at", iso(30 * day)),
    ],
    [
      "expiry_7",
      base()
        .is("reminded_expiry_7_at", null)
        .gt("expires_at", now.toISOString())
        .lte("expires_at", iso(7 * day)),
    ],
  ];

  let n = 0;
  for (const [kind, query] of sets) {
    const { data } = await query;
    for (const card of (data as GiftCardRow[] | null) ?? []) {
      if (budget <= 0) return n;
      const column = REMINDER_COLUMN[kind];
      const { data: claimed } = await supabase
        .from("gift_cards")
        .update({ [column]: now.toISOString() })
        .eq("id", card.id)
        .is(column, null)
        .select("id");
      if (!(claimed as unknown[] | null)?.length) continue;
      const { subject, doc } = reminderEmail(card, kind, env.siteUrl);
      const { html, text } = renderEmail(doc);
      const ok = await pacedSend({
        to: card.recipient_email!,
        subject,
        html,
        text,
        replyTo: STORE_INBOX,
      });
      budget--;
      await logEvent(supabase, card.id, "reminded", null, { kind, ok });
      if (ok) n++;
      // Түр алдаа — дараагийн cron (өдрийн төсөв дотор) дахин оролдоно.
      else await supabase.from("gift_cards").update({ [column]: null }).eq("id", card.id);
    }
  }
  return n;
}
