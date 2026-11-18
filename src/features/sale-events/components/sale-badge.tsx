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
 * `badge_label` («Black Friday»), эс бөгөөс «Хямдралтай» (автомат `sale`
 * таг, 0103). Ард нь хувь: `salePct` өгвөл тэр (гар хямдрал + арга хэмжээ,
 * `salePctText` — task 2.4), эс бөгөөс арга хэмжээний «~10%»
 * (`eventPctText`). Арга хэмжээний бараа нь тэр арга хэмжээний дээд
 * зурвасны өнгөтэй (`SaleChip`).
 */
export function SaleBadge({
  productId,
  onSale,
  salePct,
  surface = "image",
}: {
  productId: string;
  /** `product.tags.includes("sale")`. */
  onSale: boolean;
  /**
   * Server-ийн тооцоолсон хувь («10%», «10–30%», «~30%») —
   * `salePctText(product.sale)`. undefined бол арга хэмжээний хувь.
   */
  salePct?: string | null;
  /**
   * `image` — картын зураг дээр (цагаан хагас тунгалаг дэвсгэр); `page` —
   * барааны хуудасны тагуудын мөрөнд (бусад тагтай ижил өнгөт дэвсгэр).
   */
  surface?: "image" | "page";
}) {
  const event = useSaleEventBadge(productId);
  const eventPct = eventPctText(useSaleEventPct(productId));
  const pct = salePct === undefined ? eventPct : salePct;
  const theme = useSaleEventTheme(productId);
  const label =
    event ?? (onSale || eventPct ? SALE_EVENT_DEFAULT_BADGE : null);
  if (!label) return null;
  return (
    <SaleChip theme={theme} pct={pct} surface={surface}>
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
  surface = "image",
  className,
  children,
}: {
  theme: SaleEventTickerTheme | null;
  pct: string | null;
  surface?: "image" | "page";
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
          : surface === "image" && "bg-background/85! backdrop-blur-sm",
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
