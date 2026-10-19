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
 * - `freshCount` нь `fresh`-ээс их байж болно (сервер ≤20-ыг л буцаадаг).
 *   Цонх давхцдаг тул тэр илүүдэл нь өмнө үзүүлсэн мөр байж болно — буцсан
 *   бүх мөр шинэ байвал л (илүүдэл нь тэднээс хуучин) шинэд тооцно.
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
  const hidden =
    items.length === input.fresh.length
      ? Math.max(0, input.freshCount - input.fresh.length)
      : 0;
  const count = items.length + hidden;
  if (count > TOAST_GROUP_OVER) return { type: "summary", count };
  return { type: "single", items };
}

/** Toast hook-ийн боловсруулсан poll: кэшийн `epoch` + сүүлийн `seq`. */
export interface PollMark {
  epoch: number;
  seq: number;
}

/**
 * Poll-ын хариуг боловсруулах эсэх. `epoch` өөр бол poll кэш шинээр эхэлсэн
 * (гарч орсон / хэрэглэгч солигдсон) — `reset` (үзүүлсэн id-ыг хаяна).
 * Ижил `seq`-ийг (optimistic badge засвар г.м.) дахин боловсруулахгүй.
 */
export function trackPoll(
  mark: PollMark,
  data: PollMark,
): { mark: PollMark; reset: boolean; process: boolean } {
  const reset = mark.epoch !== data.epoch;
  const last = reset ? 0 : mark.seq;
  if (data.seq <= last) return { mark, reset, process: false };
  return { mark: { epoch: data.epoch, seq: data.seq }, reset, process: true };
}
