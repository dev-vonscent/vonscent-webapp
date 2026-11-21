"use client";

import { useSaleEventTheme } from "@/features/sale-events/components/sale-events-provider";
import type { SaleEventTickerTheme } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SaleCountdown } from "./sale-countdown";

/**
 * Картын зургийн ёроолд наалдсан хямдрал дуусах тууз (2.2, туг
 * `sale_display`). Анхдагчаар зургийн `Link` дотор `absolute` — булангийн
 * радиусыг эцгийн `overflow-hidden rounded-2xl` тайрна (өөрийн radius-гүй,
 * тиймээс булан дээр зургийн ирмэг цухуйхгүй). `className`-аар байрлалыг
 * дарж болно (багцын overlay карт — урсгал дотор, `static`).
 *
 * Өнгө: LIVE арга хэмжээ байвал түүний зурвасны өнгө (`data-ticker` →
 * `--announce`, `SaleChip`-тэй ижил), эс бөгөөс `--sale`.
 * Цул өнгө, backdrop-blur-гүй: blur нь тусдаа composite давхарга үүсгэж
 * эцгийн rounded clip-ээс зугтдаг (булан дээр зургийн цагаан цухуйдаг байв).
 * `endsAt` хоосон / туг хаалттай бол `SaleCountdown` юу ч гаргахгүй.
 */
export function SaleBand({
  endsAt,
  theme,
  className,
}: {
  endsAt: string | null | undefined;
  theme: SaleEventTickerTheme | null | undefined;
  className?: string;
}) {
  return (
    <div data-ticker={theme || undefined} className="contents">
      <SaleCountdown
        endsAt={endsAt}
        label={false}
        className={cn(
          "absolute inset-x-0 bottom-0 h-7 justify-center",
          theme
            ? "bg-announce text-announce-chip"
            : "bg-sale text-sale-foreground",
          className,
        )}
      />
    </div>
  );
}

/** Барааны карт — өнгө нь бараа орсон LIVE арга хэмжээнээс. */
export function CardSaleBand({
  productId,
  endsAt,
  byEvent,
}: {
  productId: string;
  endsAt: string | null | undefined;
  /** `SaleSummary.byEvent` — false бол гар хямдрал: энгийн `--sale` өнгө. */
  byEvent?: boolean;
}) {
  const theme = useSaleEventTheme(productId);
  return <SaleBand endsAt={endsAt} theme={byEvent === false ? null : theme} />;
}
