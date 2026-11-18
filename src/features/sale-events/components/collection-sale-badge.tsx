"use client";

import { Badge } from "@/components/ui/badge";
import { useFeatureFlag } from "@/components/feature-flags";
import { SALE_EVENT_DEFAULT_BADGE } from "@/lib/constants";
import { formatDiscountRange } from "@/features/collections/pricing";
import type { CollectionCardData } from "@/features/collections/types";
import { SaleChip } from "./sale-badge";
import { useLiveSaleEvents } from "./sale-events-provider";

/**
 * Багцын картын хөнгөлөлтийн тэмдэг. LIVE арга хэмжээнд орсон бэлэн багц
 * (16.7, туг `sale_event_bundles`) бол барааны картын адил тэр арга
 * хэмжээний тэмдэг, өнгөтэй («Black Friday −10%»); эс бөгөөс өмнөх шигээ
 * «−5%». Туг хаалттай бол `collection.event` серверээс ирэхгүй ба энд ч
 * client давхаргаар дахин хаана.
 */
export function CollectionSaleBadge({
  collection,
}: {
  collection: Pick<CollectionCardData, "discountRange" | "event">;
}) {
  const bundlesOn = useFeatureFlag("sale_event_bundles");
  const events = useLiveSaleEvents();
  const range = formatDiscountRange(collection.discountRange);
  if (!range) return null;
  const live =
    bundlesOn && collection.event
      ? events.find((e) => e.slug === collection.event?.slug)
      : undefined;
  if (live) {
    return (
      <SaleChip theme={live.tickerTheme} pct={`−${range}`}>
        {live.badgeLabel?.trim() || SALE_EVENT_DEFAULT_BADGE}
      </SaleChip>
    );
  }
  return (
    <Badge variant="sale" className="bg-background/85! w-fit backdrop-blur-sm">
      −{range}
    </Badge>
  );
}
