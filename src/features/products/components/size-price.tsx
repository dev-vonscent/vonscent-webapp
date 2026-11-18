"use client";

import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { salePct } from "@/features/products/sale";
import { SaleCountdown } from "@/features/products/components/sale-countdown";

/**
 * Хэмжээ сонгогчийн ДЭЭРХ үнийн хэсэг (task 15, 2.6) — хэмжээ солиход
 * дагаж шинэчлэгдэнэ: үнэ (хямдралтай бол хямдарсан), зураастай үндсэн үнэ,
 * хувь (`−15%`, `salePct` — картын chip-тэй ижил томьёо), сонгосон хэмжээ,
 * дуусах тоолуур.
 *
 * - Тоолуур нь СОНГОСОН хэмжээнийх; хямдралгүй хэмжээ сонговол нуугдана.
 *   Сервер зөвхөн ISO өгнө — текст client дээр (`SaleCountdown`, туг
 *   `sale_display`).
 * - Дууссан хэмжээ сонгосон ч үнэ харагдана (task 4).
 * - `aria-live` зөвхөн үнийн мөрөнд — секунд тутмын тоолуур зарлагдахгүй.
 */
export function SizePrice({
  price,
  basePrice,
  sizeLabel,
  endsAt,
  pct: pctOverride,
  size = "lg",
}: {
  price: number;
  /** Зураастай харагдах үнэ (ус — үндсэн үнэ, багц — гишүүдийн нийлбэр). */
  basePrice: number;
  /** «5ml», багцад «4 × 5ml». null бол хэмжээ сонгогдоогүй. */
  sizeLabel: string | null;
  /** Сонгосон хэмжээний хямдрал дуусах мөч (ISO). */
  endsAt?: string | null;
  /**
   * Харуулах хувь — өгөөгүй бол `salePct(basePrice, price)`. Багц админы
   * амласан хувийг (`nominalDiscountPct`) өгнө: 100₮-т тэгшлэлтээс гарах
   * 1пп-ийн зөрүү картын «−5%»-тай зөрөхгүй.
   */
  pct?: number;
  /** `lg` — дэлгэрэнгүй хуудас, `sm` — quick-add цонх. */
  size?: "lg" | "sm";
}) {
  const pct =
    price < basePrice ? (pctOverride ?? salePct(basePrice, price)) : 0;
  const lg = size === "lg";
  return (
    <div className={lg ? "space-y-1.5" : "space-y-1"}>
      <p
        aria-live="polite"
        data-testid="size-price"
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
      >
        <span
          className={cn(
            "tabular-nums",
            lg
              ? "font-serif text-3xl font-semibold"
              : "font-semibold tracking-tight",
          )}
        >
          {formatPrice(price)}
        </span>
        {pct > 0 && (
          <>
            <span
              className={cn(
                "text-muted-foreground tabular-nums line-through",
                lg ? "text-base" : "text-xs",
              )}
            >
              {formatPrice(basePrice)}
            </span>
            {/* `sale` token — бүх theme-д ижил. Бараан улаан нь хар
                дэвсгэр дээр текст болж уншигдахгүй (3:1) тул цагаан тоотой
                жижиг pill (6.5:1). */}
            <span
              data-testid="size-price-pct"
              className={cn(
                "bg-sale text-sale-foreground self-center rounded-full px-1.5 py-0.5 leading-none font-semibold tabular-nums",
                lg ? "text-sm" : "text-xs",
              )}
            >
              −{pct}%
            </span>
          </>
        )}
        {sizeLabel && (
          <span
            className={cn("text-muted-foreground", lg ? "text-sm" : "text-xs")}
          >
            / {sizeLabel}
          </span>
        )}
      </p>
      {/* Дэлгэрэнгүйд том хайрцагтай, quick-add-д нэг мөр. */}
      <SaleCountdown
        endsAt={pct > 0 ? endsAt : null}
        variant={lg ? "boxes" : "inline"}
        className={lg ? "pt-2" : undefined}
      />
    </div>
  );
}
