import type { NotificationFeedPage, NotificationPoll } from "./types";
import type { NotificationReadInput } from "@/lib/validators/notification";

/**
 * Мэдэгдлийн client fetch-үүд (`/api/notifications*`). Demo орчинд
 * (`{ demo: true }`) хоосон хариу.
 */

export async function fetchNotificationFeed(
  cursor?: string,
  limit = 20,
): Promise<NotificationFeedPage> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/api/notifications?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("notifications_feed_failed");
  const data = (await res.json()) as Partial<NotificationFeedPage>;
  return { items: data.items ?? [], nextCursor: data.nextCursor ?? null };
}

export async function fetchNotificationPoll(
  cursor?: string,
): Promise<NotificationPoll> {
  const qs = cursor ? `?${new URLSearchParams({ cursor })}` : "";
  const res = await fetch(`/api/notifications/poll${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("notifications_poll_failed");
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
