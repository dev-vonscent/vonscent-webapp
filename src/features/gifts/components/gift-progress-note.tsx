"use client";

import { Gift } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { GIFT_MAX_SAMPLES, GIFT_THRESHOLD } from "@/lib/constants";
import { giftProgress, giftSlotsFor } from "@/lib/gift";
import { cn } from "@/lib/utils";
import { useGiftPool } from "../use-gift-pool";

/**
 * Сагсан дээрх бэлгийн сануулга: босгын дүрэм, одоогийн эрх (мл), дараагийн
 * эрх хүртэл дутуу дүн.
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
      {/* Текст Б (клиент, 2026-09 UG). Тоо бүр constants / тохиргооноос. */}
      <div className="space-y-0.5">
        <p>
          {formatPrice(GIFT_THRESHOLD)} тутамд сонгогдсон үнэртнүүдээс {ml}мл
          бэлэгт дагалдана. (Дараагийн хуудсанд бэлгээ сонгоорой)
        </p>
        <div className="text-muted-foreground text-xs text-balance">
          {allowance > 0 && (
            <p>
              Та бэлэгт{" "}
              <strong className="text-foreground">{allowance * ml}мл</strong>{" "}
              үнэртэн сонгох эрхтэй байна.
            </p>
          )}
          {cappedByPool ? (
            <p>Бэлгийн санд одоогоор боломжтой нь {allowance * ml}мл.</p>
          ) : atMax ? (
            <p>Нэг захиалгад хамгийн ихдээ {GIFT_MAX_SAMPLES * ml}мл.</p>
          ) : (
            <p>
              Дахиад {formatPrice(toNext)}-ийн бараа нэмснээр {ml}мл бэлэг
              нэмэгдэнэ.
            </p>
          )}
          <p>Купон ашигласан тохиолдолд хямдарсан дүнгээс бодогдоно.</p>
        </div>
      </div>
    </div>
  );
}
