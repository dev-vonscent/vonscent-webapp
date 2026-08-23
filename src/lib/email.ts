import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Minimal transactional email via the Resend REST API — no SDK dependency.
 * Off (returns false) until RESEND_API_KEY is set; callers must treat email
 * as best-effort and persist anything important themselves first.
 *
 * Env:
 *   RESEND_API_KEY   — enables sending.
 *   EMAIL_FROM       — verified sender, e.g. "Vonscent <no-reply@vonscent.mn>"
 *                      (defaults to Resend's onboarding sender for dev).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
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

/** The store inbox for contact-form and admin notifications. */
export const STORE_INBOX =
  process.env.STORE_INBOX_EMAIL ?? "vonscent.store@gmail.com";
