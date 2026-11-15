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
  live: "Идэвхтэй",
  ended: "Дууссан",
};

/**
 * Секундээр гүйх тоолуур: «2 өдөр 04:31:10», нэг өдрөөс бага бол «04:31:10».
 * Дээш нь секунд хүртэл дугуйрна (0.2с үлдсэн ч «00:00:01»). Дууссан → null.
 */
export function formatTimer(ms: number): string | null {
  const t = timerParts(ms);
  if (!t) return null;
  const hms = `${t.hh}:${t.mm}:${t.ss}`;
  return t.days > 0 ? `${t.days} өдөр ${hms}` : hms;
}

/** Тоолуурын хэсгүүд (зурвас тоо, нэгжийг тусад нь зурна). Дууссан → null. */
export function timerParts(
  ms: number,
): { days: number; hh: string; mm: string; ss: string } | null {
  if (!(ms > 0)) return null;
  const total = Math.ceil(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    days: Math.floor(total / 86_400),
    hh: pad(Math.floor((total % 86_400) / 3600)),
    mm: pad(Math.floor((total % 3600) / 60)),
    ss: pad(total % 60),
  };
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
    return "Зарим бараа хугацаа давхацсан өөр арга хэмжээнд аль хэдийн байна.";
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
