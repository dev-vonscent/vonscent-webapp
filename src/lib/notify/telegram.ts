import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Admin notifications via a Telegram bot — best-effort, like email.ts.
 * Off (no-op) until TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID are set.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN      — from @BotFather.
 *   TELEGRAM_ADMIN_CHAT_ID  — recipient chat id(s), comma-separated so the
 *                             client's id can be added at release without
 *                             touching code (groups use negative ids).
 */

function chatIds(): string[] {
  return (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN) && chatIds().length > 0;
}

/** Escape user-provided text for Telegram's HTML parse mode. */
export function tgEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Send an HTML-formatted message to every admin chat. Never throws. */
export async function notifyAdmin(html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await Promise.all(
    chatIds().map(async (chatId) => {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: html,
              parse_mode: "HTML",
            }),
          },
        );
        if (!res.ok) {
          Sentry.captureMessage(
            `Telegram notify failed for chat ${chatId} (${res.status})`,
            "warning",
          );
        }
      } catch (err) {
        Sentry.captureException(err);
      }
    }),
  );
}
