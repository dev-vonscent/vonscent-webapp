"use client";

import { useFeatureFlag } from "@/components/feature-flags";
import { bundleSaleEndsAt } from "@/features/collections/pricing";
import type { CollectionCardData } from "@/features/collections/types";
import { SaleBand } from "@/features/products/components/card-sale-band";
import { useLiveSaleEvents } from "./sale-events-provider";

/**
 * Багцын картын зургийн ёроолын хямдрал дуусах тууз (task 2.2) — барааны
 * картын `CardSaleBand`-тэй ижил (туг `sale_display`, дундын tick, зөвхөн
 * client); өнгө нь багцын LIVE арга хэмжээний зурвасны өнгө. Туг
 * `sale_event_bundles` хаалттай бол багц event-д байхгүй — server ч `event`
 * өгөхгүй, энд ч дахин хаана. Суурь хувь хугацаагүй → туузгүй.
 */
export function CollectionSaleBand({
  collection,
  className,
}: {
  collection: Pick<CollectionCardData, "event" | "soldOut">;
  className?: string;
}) {
  const bundlesOn = useFeatureFlag("sale_event_bundles");
  const events = useLiveSaleEvents();
  if (!bundlesOn || collection.soldOut) return null;
  const live = collection.event
    ? events.find((e) => e.slug === collection.event?.slug)
    : undefined;
  return (
    <SaleBand
      endsAt={bundleSaleEndsAt(collection)}
      theme={live?.tickerTheme}
      className={className}
    />
  );
}
