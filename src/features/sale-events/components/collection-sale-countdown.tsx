"use client";

import { useFeatureFlag } from "@/components/feature-flags";
import { bundleSaleEndsAt } from "@/features/collections/pricing";
import type { CollectionCardData } from "@/features/collections/types";
import { SaleCountdown } from "@/features/products/components/sale-countdown";

/**
 * Арга хэмжээнд орсон бэлэн багцын тоолуур (task 2.2) — барааны картынхтай
 * ижил `SaleCountdown` (туг `sale_display`, дундын tick, зөвхөн client).
 * Туг `sale_event_bundles` хаалттай бол багц event-д байхгүй — server ч
 * `event` өгөхгүй, энд ч дахин хаана. Суурь хувь хугацаагүй → тоолуургүй.
 */
export function CollectionSaleCountdown({
  collection,
  className,
}: {
  collection: Pick<CollectionCardData, "event" | "soldOut">;
  className?: string;
}) {
  const bundlesOn = useFeatureFlag("sale_event_bundles");
  if (!bundlesOn || collection.soldOut) return null;
  return (
    <SaleCountdown
      endsAt={bundleSaleEndsAt(collection)}
      className={className}
    />
  );
}
