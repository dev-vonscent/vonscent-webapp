import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Minimal transactional email via the Resend REST API — no SDK dependency.
 * Off (returns false) until RESEND_API_KEY is set; callers must treat email
 * as best-effort and persist anything important themselves first.
 *
 * Захидлын агуулгыг гараар бүү угса — `renderEmail()` (layout.ts) хос
 * html/text гаргаж өгнө, бүх захидал нэг загвартай байх ёстой.
 *
 * Env:
 *   RESEND_API_KEY   — enables sending.
 *   EMAIL_FROM       — verified sender, e.g. "Vonscent <no-reply@vonscent.mn>"
 *                      (defaults to Resend's onboarding sender for dev).
 *   EMAIL_MAILPIT_URL — зөвхөн `.env.localdb`: локал Supabase-ийн Mailpit
 *                      (http://127.0.0.1:54324). Тохируулсан бол Resend-ийн
 *                      оронд тийшээ илгээнэ — захидлыг браузерт харна, гадагш
 *                      юу ч гарахгүй.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Where a reply should land. `no-reply@` is not a real mailbox — a verified
   * domain may send from any address, but nothing receives there — so customer
   * mail points replies at the store inbox instead of dropping them.
   */
  replyTo?: string;
  /** Extra SMTP headers, e.g. List-Unsubscribe on marketing-adjacent mail. */
  headers?: Record<string, string>;
}): Promise<boolean> {
  const mailpit = process.env.EMAIL_MAILPIT_URL;
  if (mailpit) return sendToMailpit(mailpit, params);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Vonscent <onboarding@resend.dev>",
        to: [params.to],
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      }),
    });
    if (!res.ok) {
      Sentry.captureMessage(
        `Resend rejected email "${params.subject}" (${res.status})`,
        "warning",
      );
    }
    return res.ok;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/** Локал Mailpit-ийн send API (`POST /api/v1/send`). */
async function sendToMailpit(
  base: string,
  params: Parameters<typeof sendEmail>[0],
): Promise<boolean> {
  const from = process.env.EMAIL_FROM ?? "Vonscent <no-reply@vonscent.mn>";
  const m = from.match(/^(.*)<(.+)>$/u);
  try {
    const res = await fetch(new URL("/api/v1/send", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: m
          ? { Name: m[1]?.trim(), Email: m[2]?.trim() }
          : { Email: from },
        To: [{ Email: params.to }],
        Subject: params.subject,
        Text: params.text,
        ...(params.html ? { HTML: params.html } : {}),
        ...(params.replyTo ? { ReplyTo: [{ Email: params.replyTo }] } : {}),
        ...(params.headers ? { Headers: params.headers } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The store inbox for contact-form and admin notifications. */
export const STORE_INBOX =
  process.env.STORE_INBOX_EMAIL ?? "vonscent.store@gmail.com";
