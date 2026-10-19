import type { AppNotification } from "./types";

/** Хонхны тэмдэг: 0 бол алга, 1–99, түүнээс дээш «99+». */
export function formatBadge(unread: number): string | null {
  if (!Number.isFinite(unread) || unread <= 0) return null;
  return unread > 99 ? "99+" : String(Math.floor(unread));
}

export function bellLabel(unread: number): string {
  return unread > 0 ? `Мэдэгдэл, уншаагүй ${unread}` : "Мэдэгдэл";
}

/** Хэдээс ОЛОН бол нэг нэгтгэсэн toast болгох вэ (plan §6). */
export const TOAST_GROUP_OVER = 2;

export type ToastPlan =
  | { type: "none" }
  | { type: "single"; items: AppNotification[] }
  | { type: "summary"; count: number };

/**
 * Poll-ын шинэ мөрүүдээс ямар toast гаргахыг шийднэ (цэвэр функц — тесттэй).
 *
 * - `initial` — анхны poll: хуучин уншаагүйг toast болгохгүй.
 * - `visible` — зөвхөн харагдаж буй tab toast гаргана.
 * - `shown` — өөр tab аль хэдийн үзүүлсэн id (BroadcastChannel, best-effort).
 * - `freshCount` нь `fresh`-ээс их байж болно (сервер ≤5-ыг л буцаадаг).
 */
export function planToasts(input: {
  fresh: AppNotification[];
  freshCount: number;
  initial: boolean;
  visible: boolean;
  shown: ReadonlySet<string>;
}): ToastPlan {
  if (input.initial || !input.visible) return { type: "none" };
  const items = input.fresh.filter((n) => !n.read && !input.shown.has(n.id));
  if (items.length === 0) return { type: "none" };
  const hidden = Math.max(0, input.freshCount - input.fresh.length);
  const count = items.length + hidden;
  if (count > TOAST_GROUP_OVER) return { type: "summary", count };
  return { type: "single", items };
}
