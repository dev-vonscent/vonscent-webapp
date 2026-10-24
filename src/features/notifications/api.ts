import type { NotificationFeedPage, NotificationPoll } from "./types";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/constants";
import type { NotificationReadInput } from "@/lib/validators/notification";

/**
 * Мэдэгдлийн client fetch-үүд (`/api/notifications*`). Demo орчинд
 * (`{ demo: true }`) хоосон хариу.
 */

export async function fetchNotificationFeed(
  cursor?: string,
  limit = NOTIFICATION_PAGE_SIZE,
): Promise<NotificationFeedPage> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/api/notifications?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("notifications_feed_failed");
  const data = (await res.json()) as Partial<NotificationFeedPage>;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

/** Poll-ын алдаа — 401 (session дууссан) / 404 (туг хаагдсан) дээр дахин оролдохгүй. */
export class NotificationPollError extends Error {
  constructor(readonly status: number) {
    super("notifications_poll_failed");
  }
  get final(): boolean {
    return this.status === 401 || this.status === 404;
  }
}

export async function fetchNotificationPoll(
  cursor?: string,
): Promise<NotificationPoll> {
  const qs = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  const res = await fetch(`/api/notifications/poll${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new NotificationPollError(res.status);
  const data = (await res.json()) as Partial<NotificationPoll>;
  return {
    unread: data.unread ?? 0,
    freshCount: data.freshCount ?? 0,
    fresh: data.fresh ?? [],
    nextCursor: data.nextCursor ?? cursor ?? "",
  };
}

export async function postNotificationsRead(
  input: NotificationReadInput,
): Promise<void> {
  const res = await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("notifications_read_failed");
}
