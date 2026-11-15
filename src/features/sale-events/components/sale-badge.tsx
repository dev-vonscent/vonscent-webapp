"use client";

import { Badge } from "@/components/ui/badge";
import { SALE_EVENT_DEFAULT_BADGE } from "@/lib/constants";
import { eventPctText } from "../lib";
import { useSaleEventBadge, useSaleEventPct } from "./sale-events-provider";

/**
 * Барааны картын хямдралын тэмдэг. Live арга хэмжээнд (0181) байвал түүний
 * `badge_label` («Black Friday»), эс бөгөөс одоогийн «Хямдрал» (автомат
 * `sale` таг, 0103). Арга хэмжээний хувьтай бол ард нь «~10%» (хамгийн их
 * хувь — `eventPctText`).
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
  const pct = eventPctText(useSaleEventPct(productId));
  const label = event ?? (onSale || pct ? SALE_EVENT_DEFAULT_BADGE : null);
  if (!label) return null;
  return (
    <Badge variant="sale" className="bg-background/85! w-fit gap-1 backdrop-blur-sm">
      {label}
      {pct && <span className="tabular-nums">{pct}</span>}
    </Badge>
  );
}
