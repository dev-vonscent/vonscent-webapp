"use client";

import { Badge } from "@/components/ui/badge";
import { SALE_EVENT_DEFAULT_BADGE } from "@/lib/constants";
import { useSaleEventBadge } from "./sale-events-provider";

/**
 * Барааны картын хямдралын тэмдэг. Live арга хэмжээнд (0181) байвал түүний
 * `badge_label` («Black Friday»), эс бөгөөс одоогийн «Хямдрал» (автомат
 * `sale` таг, 0103). Хувьгүй «сонголт» арга хэмжээ (жишээ: «Аавуудад
 * бэлэг») ч өөрийн тэмдэгтэй гарна.
 */
export function SaleBadge({
  productId,
  onSale,
}: {
  productId: string;
  /** `product.tags.includes("sale")`. */
  onSale: boolean;
}) {
  const event = useSaleEventBadge(productId);
  const label = event ?? (onSale ? SALE_EVENT_DEFAULT_BADGE : null);
  if (!label) return null;
  return (
    <Badge variant="sale" className="bg-background/85! w-fit backdrop-blur-sm">
      {label}
    </Badge>
  );
}
