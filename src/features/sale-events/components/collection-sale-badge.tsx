"use client";

import { Badge } from "@/components/ui/badge";
import { useFeatureFlag } from "@/components/feature-flags";
import { SALE_EVENT_DEFAULT_BADGE } from "@/lib/constants";
import {
  bundleEventSale,
  formatDiscountRange,
} from "@/features/collections/pricing";
import { salePctText } from "@/features/products/sale";
import type { CollectionCardData } from "@/features/collections/types";
import { SaleChip } from "./sale-badge";
import { useLiveSaleEvents } from "./sale-events-provider";

/**
 * Багцын картын хөнгөлөлтийн тэмдэг. LIVE арга хэмжээнд орсон бэлэн багц
 * (16.7, туг `sale_event_bundles`) бол барааны картын адил тэр арга
 * хэмжээний тэмдэг, өнгөтэй, барааны хувийн дүрмээр («Black Friday ~10%»,
 * `bundleEventSale`); эс бөгөөс өмнөх шигээ «−5%». Туг хаалттай бол `collection.event` серверээс ирэхгүй ба энд ч
 * client давхаргаар дахин хаана.
 */
export function CollectionSaleBadge({
  collection,
  surface = "card",
}: {
  collection: Pick<CollectionCardData, "discountRange" | "event"> &
    Parameters<typeof bundleEventSale>[0];
  /**
   * `card` — каталогийн карт; `detail` — багцын дэлгэрэнгүйн зураг дээр
   * (арга хэмжээгүй үед өмнөх «−5%» тэмдгийн төрх яг хэвээрээ).
   */
  surface?: "card" | "detail";
}) {
  const bundlesOn = useFeatureFlag("sale_event_bundles");
  const events = useLiveSaleEvents();
  const range = formatDiscountRange(collection.discountRange);
  if (!range) return null;
  const live =
    bundlesOn && collection.event
      ? events.find((e) => e.slug === collection.event?.slug)
      : undefined;
  // Барааны chip-тэй ижил формат (2.4): «10%» / «10–15%» / «~10%» — суурь
  // хувь биш, зөвхөн event-ийн хувь. Event хаана ч үйлчлэхгүй бол «−5%».
  const pct = live ? salePctText(bundleEventSale(collection)) : null;
  if (live && pct) {
    return (
      <SaleChip theme={live.tickerTheme} pct={pct} fit={surface === "card"}>
        {live.badgeLabel?.trim() || SALE_EVENT_DEFAULT_BADGE}
      </SaleChip>
    );
  }
  return (
    <Badge
      variant="sale"
      className={
        surface === "detail"
          ? "w-fit backdrop-blur-sm"
          : "bg-background/85! w-fit backdrop-blur-sm"
      }
    >
      −{range}
    </Badge>
  );
}
