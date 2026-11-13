import type { LiveSaleEvent, SaleEventPhase } from "./types";

/**
 * Админы төлөв. `ends_at` exclusive (0181): яг тэр мөчөөс «Дууссан».
 * SQL-ийн `sale_event_public`-ийн `state`-тэй ижил дүрэм.
 */
export function saleEventPhase(
  e: { isActive: boolean; startsAt: string; endsAt: string },
  now: number = Date.now(),
): SaleEventPhase {
  if (!e.isActive) return "draft";
  if (now < Date.parse(e.startsAt)) return "scheduled";
  if (now < Date.parse(e.endsAt)) return "live";
  return "ended";
}

export const SALE_EVENT_PHASE_LABEL: Record<SaleEventPhase, string> = {
  draft: "Ноорог",
  scheduled: "Товлосон",
  live: "Явж байна",
  ended: "Дууссан",
};

/**
 * Үлдсэн хугацаа: «2 өдөр 4 цаг», «3 цаг 12 мин», «45 мин». Хугацаа
 * дууссан бол null. Секунд харуулахгүй — минут тутам шинэчлэгдэнэ.
 */
export function formatCountdown(ms: number): string | null {
  if (!(ms > 0)) return null;
  const totalMin = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days} өдөр ${hours} цаг` : `${days} өдөр`;
  if (hours > 0) return mins > 0 ? `${hours} цаг ${mins} мин` : `${hours} цаг`;
  return `${mins} мин`;
}

/**
 * productId → картан дээрх тэмдэг, зөвхөн `badge_label`-тай арга хэмжээнд.
 * Тэмдэггүй бол карт одоогийн «Хямдрал»-аа (`sale` таг) харуулна — хувьгүй
 * «сонголт» арга хэмжээний бараан дээр худал «Хямдрал» гарахгүй. Нэг бараа
 * давхцсан хоёр идэвхтэй арга хэмжээнд орохгүй (0181 trigger) тул эхнийх нь л.
 */
export function eventBadgeMap(
  events: readonly LiveSaleEvent[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of events) {
    const label = e.badgeLabel?.trim();
    if (!label) continue;
    for (const id of e.productIds) out[id] ??= label;
  }
  return out;
}

/** Давхцсан нэг бараа — 0181 `EVENT_OVERLAP`-ийн `detail` (jsonb). */
export interface OverlapConflict {
  productId: string;
  product: string;
  brand: string;
  event: string;
  startsAt: string;
  endsAt: string;
}

/** `detail` → жагсаалт. Буруу/хоосон бол []. */
export function overlapConflicts(
  detail: string | null | undefined,
): OverlapConflict[] {
  if (!detail) return [];
  try {
    const raw: unknown = JSON.parse(detail);
    return Array.isArray(raw)
      ? raw.filter(
          (r): r is OverlapConflict =>
            typeof r === "object" &&
            r != null &&
            typeof (r as OverlapConflict).productId === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** «2026.11.23–11.30» — `ends_at` exclusive тул сүүлийн өдөр нь өмнөх өдөр. */
export function formatEventPeriod(startsAt: string, endsAt: string): string {
  const day = (t: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ulaanbaatar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date(t))
      .replaceAll("-", ".");
  const from = day(Date.parse(startsAt));
  const to = day(Date.parse(endsAt) - 1);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${from}–${to.slice(5)}`
    : `${from}–${to}`;
}

/**
 * «Энэ 4 бараа "Black Friday"-д (2026.11.23–11.30) аль хэдийн байна: A, B, C…»
 * — арга хэмжээ бүрээр бүлэглэнэ.
 */
export function overlapMessage(conflicts: readonly OverlapConflict[]): string {
  if (!conflicts.length) {
    return "Зарим бараа хугацаа давхцсан өөр арга хэмжээнд аль хэдийн байна.";
  }
  const byEvent = new Map<string, OverlapConflict[]>();
  for (const c of conflicts) {
    const key = `${c.event}|${c.startsAt}|${c.endsAt}`;
    byEvent.set(key, [...(byEvent.get(key) ?? []), c]);
  }
  return [...byEvent.values()]
    .map((list) => {
      const names = list.slice(0, 5).map((c) => `${c.brand} ${c.product}`);
      const more = list.length > 5 ? ` г.м. (${list.length})` : "";
      return `Энэ ${list.length} бараа «${list[0].event}»-д (${formatEventPeriod(
        list[0].startsAt,
        list[0].endsAt,
      )}) аль хэдийн байна: ${names.join(", ")}${more}.`;
    })
    .join(" ");
}
