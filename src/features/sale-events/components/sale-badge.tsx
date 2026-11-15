"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  SALE_EVENT_DEFAULT_BADGE,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { eventPctText } from "../lib";
import {
  useSaleEventBadge,
  useSaleEventPct,
  useSaleEventTheme,
} from "./sale-events-provider";

/**
 * Барааны картын хямдралын тэмдэг. Live арга хэмжээнд (0181) байвал түүний
 * `badge_label` («Black Friday»), эс бөгөөс одоогийн «Хямдрал» (автомат
 * `sale` таг, 0103). Арга хэмжээний хувьтай бол ард нь «~10%» (хамгийн их
 * хувь — `eventPctText`). Арга хэмжээний бараа нь тэр арга хэмжээний дээд
 * зурвасны өнгөтэй (`SaleChip`).
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
  const theme = useSaleEventTheme(productId);
  const label = event ?? (onSale || pct ? SALE_EVENT_DEFAULT_BADGE : null);
  if (!label) return null;
  return (
    <SaleChip theme={theme} pct={pct}>
      {label}
    </SaleChip>
  );
}

/**
 * Тэмдгийн төрх — дэлгүүр ба студийн ③ харагдац хоёуланд (төрх зөрөхгүй).
 * `theme` байвал арга хэмжээний зурвасны цул өнгө (`[data-ticker]`,
 * globals.css; бичиг ≥4.5:1), эс бөгөөс одоогийн цагаан хагас тунгалаг +
 * улаан бичиг. «~10%» нь accent өнгөөр.
 */
export function SaleChip({
  theme,
  pct,
  className,
  children,
}: {
  theme: SaleEventTickerTheme | null;
  pct: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="sale"
      data-ticker={theme ?? undefined}
      className={cn(
        "w-fit gap-1",
        theme
          ? "bg-announce! text-announce-chip! font-semibold"
          : "bg-background/85! backdrop-blur-sm",
        className,
      )}
    >
      {children}
      {pct && (
        <span
          className={cn(
            "shrink-0 tabular-nums",
            theme && "text-announce-chip-accent",
          )}
        >
          {pct}
        </span>
      )}
    </Badge>
  );
}
