import { subDays, subMonths } from "date-fns";
import { USER_TIERS, type UserTierKey } from "@/lib/constants";

/**
 * Хэрэглэгчийн түвшний цэвэр тооцоо (0138, feature flag `user_tiers`).
 *
 * Оноог сан бодно (`mark_order_paid` → `tier_rate_for_spend`); энд байгаа нь
 * ЗӨВХӨН харуулах — тиймээс босго, хувь нь SQL-тэй таарах ёстой.
 */

export type UserTier = (typeof USER_TIERS)[number];

/** Нийт худалдан авалтад харгалзах түвшин. */
export function tierForSpend(spend: number): UserTier {
  let tier: UserTier = USER_TIERS[0];
  for (const t of USER_TIERS) if (spend >= t.minSpend) tier = t;
  return tier;
}

export function tierByKey(key: UserTierKey): UserTier {
  return USER_TIERS.find((t) => t.key === key) ?? USER_TIERS[0];
}

export function nextTierOf(tier: UserTier): UserTier | null {
  const i = USER_TIERS.findIndex((t) => t.key === tier.key);
  return USER_TIERS[i + 1] ?? null;
}

export interface TierProgress {
  tier: UserTier;
  next: UserTier | null;
  /** Дараагийн түвшин хүртэл үлдсэн ₮ (дээд түвшинд 0). */
  remaining: number;
  /** Одоогийн түвшний доторх явц, 0…1 (дээд түвшинд 1). */
  ratio: number;
}

export function tierProgress(spend: number): TierProgress {
  const tier = tierForSpend(spend);
  const next = nextTierOf(tier);
  if (!next) return { tier, next, remaining: 0, ratio: 1 };
  const span = next.minSpend - tier.minSpend;
  return {
    tier,
    next,
    remaining: Math.max(next.minSpend - spend, 0),
    ratio: Math.min(Math.max((spend - tier.minSpend) / span, 0), 1),
  };
}

/**
 * Түвшний хувиар хуримтлагдах оноо — `mark_order_paid`-ийн
 * `floor(v_base * v_rate / 100)`-ийн хуулбар (lib/loyalty.ts-ийн
 * `pointsEarnedFor`-ийн туг асаалттай үеийн хувилбар).
 */
export function pointsAtTierRate(goodsAfterDiscount: number, rate: number) {
  const base = Math.max(Math.round(goodsAfterDiscount), 0);
  return Math.floor((base * rate) / 100);
}

/** Топ жагсаалтад харагдах нэр — нэр оруулаагүй бол ерөнхий нэр. */
export function displayName(fullName: string | null | undefined): string {
  return fullName?.trim() || "vonscent гишүүн";
}

export type LeaderboardPeriod = "week" | "month" | "all";

export const LEADERBOARD_PERIODS: readonly {
  key: LeaderboardPeriod;
  label: string;
}[] = [
  { key: "week", label: "Сүүлийн 7 хоног" },
  { key: "month", label: "Сүүлийн 1 сар" },
  { key: "all", label: "Бүх цаг үе" },
];

/**
 * Топ жагсаалтын хугацаа — одоогоос ухраах гулсах цонх (клиент,
 * 2026-10-19): сүүлийн 7 хоног, сүүлийн 1 сар, бүх цаг үе.
 */
export function periodRange(
  period: LeaderboardPeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = new Date(now.getTime());
  if (period === "week") return { from: subDays(now, 7), to };
  if (period === "month") return { from: subMonths(now, 1), to };
  return { from: new Date(0), to };
}

/**
 * Захиалгын жагсаалтаас нийт худалдан авалт — `user_lifetime_spend` (0138)-ийн
 * хуулбар: төлөгдсөн, цуцлагдаагүй захиалгын купоны дараах барааны дүн.
 */
export function lifetimeSpendOf(
  orders: readonly {
    payment_status: string;
    status: string;
    subtotal: number;
    discount: number | null;
  }[],
): number {
  return orders
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((sum, o) => sum + Math.max(o.subtotal - (o.discount ?? 0), 0), 0);
}
