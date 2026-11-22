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
  byEvent,
  surface = "image",
}: {
  productId: string;
  /**
   * `SaleSummary.byEvent`: false бол үнийг гар хямдрал тогтоож байна —
   * бараа арга хэмжээнд бүртгэлтэй ч арга хэмжээний нэр, өнгө, хувь
   * ХЭРЭГЛЭХГҮЙ (клиентийн засвар 2026-11-21 сл.10, шийдвэр A).
   * undefined бол өмнөх шиг гишүүнчлэлээр.
   */
  byEvent?: boolean;
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
  const manualOnly = byEvent === false;
  const eventBadge = useSaleEventBadge(productId);
  const eventPctRaw = eventPctText(useSaleEventPct(productId));
  const eventTheme = useSaleEventTheme(productId);
  const event = manualOnly ? null : eventBadge;
  const eventPct = manualOnly ? null : eventPctRaw;
  const theme = manualOnly ? null : eventTheme;
  const pct = salePct === undefined ? eventPct : salePct;
  const label = event ?? (onSale || eventPct ? SALE_EVENT_DEFAULT_BADGE : null);
  if (!label) return null;
  return (
    <SaleChip
      theme={theme}
      pct={pct}
      surface={surface}
      // Каталогийн картад гурван төрөл (арга хэмжээ, гар хямдрал, багц) нэг
      // дүрэмтэй: нэр бүтэн багтвал «Хямдралтай 20%», эс бөгөөс зөвхөн «20%»
      // — «Хямдралт…» таслалтгүй (клиент 2026-11-21).
      fit={surface === "image"}
    >
      {label}
    </SaleChip>
  );
}

/**
 * `fit` chip-ийн нэр гарах container query-ийн босго (px). Tailwind статик
 * класс хайдаг тул бүтэн жагсаалт энд — тооцоолсон өргөнөөс дээш хамгийн
 * ойр босгыг сонгоно; хамгийн томоос давбал нэр үргэлж нуугдана.
 */
const FIT_STEPS: readonly (readonly [number, string])[] = [
  [64, "@min-[64px]/chip:inline"],
  [80, "@min-[80px]/chip:inline"],
  [96, "@min-[96px]/chip:inline"],
  [112, "@min-[112px]/chip:inline"],
  [128, "@min-[128px]/chip:inline"],
  [144, "@min-[144px]/chip:inline"],
  [160, "@min-[160px]/chip:inline"],
  [176, "@min-[176px]/chip:inline"],
  [192, "@min-[192px]/chip:inline"],
  [208, "@min-[208px]/chip:inline"],
  [224, "@min-[224px]/chip:inline"],
  [240, "@min-[240px]/chip:inline"],
  [256, "@min-[256px]/chip:inline"],
  [288, "@min-[288px]/chip:inline"],
  [320, "@min-[320px]/chip:inline"],
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
 * `fit` (каталогийн карт, бүх төрлийн chip): бүтэн «Black Friday ~30%»
 * багтах үед л нэр харагдана, эс бөгөөс ЗӨВХӨН хувь — таслагдсан үг
 * («Black…») гарахгүй. Шийдвэр нь CSS container query (`@container/chip`
 * картын тэмдгийн мөр дээр) — JS хэмжилтгүй тул SSR/hydration зөрөхгүй.
 * Уншигч үргэлж бүтэн «Black Friday, 30% хүртэл хямдралтай»-г сонсоно.
 */
export function SaleChip({
  theme,
  pct,
  surface = "image",
  fit = false,
  className,
  children,
}: {
  theme: SaleEventTickerTheme | null;
  pct: string | null;
  surface?: "image" | "page";
  /** Эцэг элемент нь `@container/chip` байх ёстой (каталогийн карт). */
  fit?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const name = typeof children === "string" ? children : null;
  const fitOn = fit && !!pct && name != null;
  const nameStep = fitOn ? fitStep(saleChipFullWidthPx(name, pct)) : undefined;
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
        // `fit`-гүй газар (барааны хуудас): нэр таслагдаж болох ч хувь
        // ҮРГЭЛЖ бүтэн — icon руу халихгүй.
        <span className="min-w-0 truncate">{children}</span>
      )}
      {pct && (
        <span data-chip-pct className={pctClass}>
          {pct}
        </span>
      )}
    </Badge>
  );
}
