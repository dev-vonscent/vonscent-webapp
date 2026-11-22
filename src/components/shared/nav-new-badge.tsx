"use client";

import { useFeatureFlagSince } from "@/components/feature-flags";
import { useNewBadge } from "@/features/account/use-new-badge";
import type { FeatureFlag } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StoreNavItem } from "./store-nav";

const DAY_MS = 86_400_000;
/** `newBadge.days` өгөөгүй үед — тугийг асааснаас хойш нэг сар. */
const DEFAULT_DAYS = 30;

/**
 * «Шинэ» тэмдгийн дуусах хугацаа (ISO): тугтай мөрөнд асаасан цаг + `days`,
 * туггүй бол `until`. Аль нь ч үгүй бол null — тэмдэг гарахгүй (мөнхөд
 * гялалзахаас дээр).
 */
export function newBadgeUntil(
  badge: NonNullable<StoreNavItem["newBadge"]>,
  hasFlag: boolean,
  flagSince: string | null,
): string | null {
  if (!hasFlag) return badge.until ?? null;
  const start = flagSince ? Date.parse(flagSince) : NaN;
  if (Number.isNaN(start)) return null;
  return new Date(start + (badge.days ?? DEFAULT_DAYS) * DAY_MS).toISOString();
}

/**
 * Цэсний шошгоны баруун дээд талын «Шинэ» тэмдэг (`StoreNavItem.newBadge`).
 * Хар цагаан цэсэнд шууд анзаарагдах ёстой тул сайтын цорын ганц тод
 * өнгө — `destructive` (хямдралын тэмдэгтэй ижил гэр бүл), дүүрэн дэвсгэр.
 * `self-start` — flex мөрөнд шошгоны дээд ирмэгтэй тэгшилж superscript
 * болно; absolute биш тул хөрш цэсийг давхарлахгүй.
 *
 * Хэрэглэгч хуудсыг нээсэн (`MarkSeen`) эсвэл хугацаа өнгөрсөн бол юу ч үгүй.
 */
export function NavNewBadge({
  item,
  className,
}: {
  item: Pick<StoreNavItem, "flag" | "newBadge">;
  className?: string;
}) {
  // Hook нөхцөлгүй; туггүй мөрөнд хоосон түлхүүр → null.
  const since = useFeatureFlagSince((item.flag ?? "") as FeatureFlag);
  const until = item.newBadge
    ? newBadgeUntil(item.newBadge, Boolean(item.flag), since)
    : null;
  // Хугацаагүй бол өнгөрсөн огноо — useNewBadge false буцаана.
  const show = useNewBadge(item.newBadge?.key ?? "", until ?? "1970-01-01");
  if (!until || !show) return null;
  return (
    <span
      className={cn(
        "bg-destructive text-destructive-foreground self-start rounded-full px-1.5 text-[10px]/4 font-semibold",
        className,
      )}
    >
      Шинэ
    </span>
  );
}
