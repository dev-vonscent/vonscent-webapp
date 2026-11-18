"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  SALE_EVENT_DEFAULT_BADGE,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  saleChipAriaLabel,
  saleChipFullWidthPx,
} from "@/features/products/sale";
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
  const label = event ?? (onSale || eventPct ? SALE_EVENT_DEFAULT_BADGE : null);
  if (!label) return null;
  return (
    <SaleChip
      theme={theme}
      pct={pct}
      surface={surface}
      fit={!!event && surface === "image"}
    >
      {label}
    </SaleChip>
  );
}

/**
 * `fit` chip-ийн container query-ийн босго (px). Tailwind статик класс
 * хайдаг тул бүтэн жагсаалт энд — тооцоолсон өргөнөөс дээш хамгийн ойр
 * босгыг сонгоно; хамгийн томоос давбал тэр хэсэг үргэлж нуугдана.
 * `show` — тэр өргөнөөс дээш харуулах, `hide` — тэр өргөнөөс дээш нуух.
 */
const FIT_STEPS: readonly (readonly [number, string, string])[] = [
  [64, "@min-[64px]/chip:inline", "@min-[64px]/chip:hidden"],
  [80, "@min-[80px]/chip:inline", "@min-[80px]/chip:hidden"],
  [96, "@min-[96px]/chip:inline", "@min-[96px]/chip:hidden"],
  [112, "@min-[112px]/chip:inline", "@min-[112px]/chip:hidden"],
  [128, "@min-[128px]/chip:inline", "@min-[128px]/chip:hidden"],
  [144, "@min-[144px]/chip:inline", "@min-[144px]/chip:hidden"],
  [160, "@min-[160px]/chip:inline", "@min-[160px]/chip:hidden"],
  [176, "@min-[176px]/chip:inline", "@min-[176px]/chip:hidden"],
  [192, "@min-[192px]/chip:inline", "@min-[192px]/chip:hidden"],
  [208, "@min-[208px]/chip:inline", "@min-[208px]/chip:hidden"],
  [224, "@min-[224px]/chip:inline", "@min-[224px]/chip:hidden"],
  [240, "@min-[240px]/chip:inline", "@min-[240px]/chip:hidden"],
  [256, "@min-[256px]/chip:inline", "@min-[256px]/chip:hidden"],
  [288, "@min-[288px]/chip:inline", "@min-[288px]/chip:hidden"],
  [320, "@min-[320px]/chip:inline", "@min-[320px]/chip:hidden"],
];

function fitStep(need: number) {
  return FIT_STEPS.find(([px]) => px >= need);
}

/**
 * Тэмдгийн төрх — дэлгүүр ба студийн ③ харагдац хоёуланд (төрх зөрөхгүй).
 * `theme` байвал арга хэмжээний зурвасны цул өнгө (`[data-ticker]`,
 * globals.css; бичиг ≥4.5:1), эс бөгөөс одоогийн цагаан хагас тунгалаг +
 * улаан бичиг. «~10%» нь accent өнгөөр.
 *
 * `fit` (каталогийн карт, арга хэмжээний chip): бүтэн «Black Friday ~30%»
 * багтах үед л нэр харагдана, эс бөгөөс ЗӨВХӨН хувь — таслагдсан үг
 * («Black…») гарахгүй. Шийдвэр нь CSS container query (`@container/chip`
 * картын тэмдгийн мөр дээр) — JS хэмжилтгүй тул SSR/hydration зөрөхгүй.
 * Уншигч үргэлж бүтэн «Black Friday, 30% хүртэл хямдралтай»-г сонсоно.
 */
export function SaleChip({
  theme,
  pct,
  pctShort,
  surface = "image",
  fit = false,
  className,
  children,
}: {
  theme: SaleEventTickerTheme | null;
  pct: string | null;
  /**
   * `fit` үед `pct` хүртэл багтахгүй маш нарийн картын хувь («−10% хүртэл»
   * → «~10%», барааны «~» дүрэм).
   */
  pctShort?: string;
  surface?: "image" | "page";
  /** Эцэг элемент нь `@container/chip` байх ёстой (каталогийн карт). */
  fit?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const name = typeof children === "string" ? children : null;
  const fitOn = fit && !!pct && name != null;
  const nameStep = fitOn ? fitStep(saleChipFullWidthPx(name, pct)) : undefined;
  const pctStep =
    fitOn && pctShort ? fitStep(saleChipFullWidthPx(null, pct)) : undefined;
  const pctClass = cn(
    "shrink-0 tabular-nums",
    theme && "text-announce-chip-accent",
  );
  return (
    <Badge
      variant="sale"
      data-ticker={theme ?? undefined}
      data-sale-chip=""
      {...(fitOn && {
        role: "img",
        "aria-label": saleChipAriaLabel(name, pct),
      })}
      className={cn(
        // max-w-full: картын зүрх/сагсны icon-уудын зайгаар хязгаарлагдсан
        // контейнерт багтана (тэр зайг `right-12` өгнө).
        "w-fit max-w-full min-w-0 gap-1",
        fitOn && "whitespace-nowrap",
        theme
          ? "bg-announce! text-announce-chip! font-semibold"
          : surface === "image" && "bg-background/85! backdrop-blur-sm",
        className,
      )}
    >
      {fitOn ? (
        <span data-chip-name className={cn("hidden", nameStep?.[1])}>
          {children}
        </span>
      ) : (
        // Арга хэмжээгүй «Хямдралтай ~25%» (клиент 2026-11-18): нарийн
        // картанд нэр таслагдаж, хувь ҮРГЭЛЖ бүтэн — icon руу халихгүй.
        <span className="min-w-0 truncate">{children}</span>
      )}
      {pct &&
        (fitOn && pctShort ? (
          <>
            <span
              data-chip-pct
              className={cn(pctClass, "hidden", pctStep?.[1])}
            >
              {pct}
            </span>
            <span data-chip-pct-short className={cn(pctClass, pctStep?.[2])}>
              {pctShort}
            </span>
          </>
        ) : (
          <span data-chip-pct className={pctClass}>
            {pct}
          </span>
        ))}
    </Badge>
  );
}
