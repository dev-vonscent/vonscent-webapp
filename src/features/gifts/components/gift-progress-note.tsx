"use client";

import { Gift } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { GIFT_MAX_SAMPLES, GIFT_THRESHOLD } from "@/lib/constants";
import { giftProgress, giftSlotsFor } from "@/lib/gift";
import { cn } from "@/lib/utils";
import { useGiftPool } from "../use-gift-pool";

/**
 * Сагсан дээрх бэлгийн сануулга: «1 мл дээж авахад X₮ дутуу» эсвэл «N дээж
 * сонгох эрхтэй».
 *
 * Сагсанд купон ордоггүй тул энд купоны өмнөх дүнгээр бодно — эцсийн эрхийг
 * checkout-ийн `GiftSamplePicker` купоны дараах дүнгээр харуулна. Сан
 * унтраалттай / хоосон, эсвэл сонгосон бараа байхгүй үед юу ч харуулахгүй.
 */
export function GiftProgressNote({
  subtotal,
  className,
}: {
  /** Сонгосон мөрүүдийн барааны дүн (хүргэлт ороогүй). */
  subtotal: number;
  className?: string;
}) {
  const pool = useGiftPool();
  if (!pool?.enabled || subtotal <= 0) return null;

  const { toNext, atMax } = giftProgress(subtotal);
  // Сангийн багтаамжаар хумигдсан ТОО — checkout дээр сонгож чадах тоотой нь
  // яг ижил байх ёстой, эс тэгвэл сагс «5» гэж амлаад checkout «4» гэнэ.
  const { allowance, cappedByPool } = giftSlotsFor(
    subtotal,
    pool.products.length,
  );
  const ml = pool.sampleMl;

  return (
    <div
      className={cn(
        "bg-secondary/60 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        className,
      )}
    >
      <Gift className="text-gold-strong mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        {allowance > 0 ? (
          <p>
            Та <strong>{allowance}</strong> ширхэг {ml} мл дээжийг бэлгээр
            сонгох эрхтэй. Төлбөрийн хуудсанд сонгоно.
          </p>
        ) : (
          <p>
            {ml} мл бэлгийн дээж авахад <strong>{formatPrice(toNext)}</strong>{" "}
            дутуу байна.
          </p>
        )}
        <p className="text-muted-foreground text-xs text-balance">
          {cappedByPool
            ? `Бэлгийн санд одоогоор боломжтой нь ${allowance} ширхэг. `
            : atMax
              ? `Нэг захиалгад хамгийн ихдээ ${GIFT_MAX_SAMPLES} дээж. `
              : allowance > 0
                ? `Дахиад ${formatPrice(toNext)}-ийн бараа нэмбэл 1 дээж нэмэгдэнэ. `
                : `Барааны дүн ${formatPrice(GIFT_THRESHOLD)} тутамд 1 дээж бэлгээр сонгоно. `}
          Купон ашиглавал эрхийг хямдарсан дүнгээр бодно.
        </p>
      </div>
    </div>
  );
}
