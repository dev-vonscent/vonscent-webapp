"use client";

import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { salePct } from "@/features/products/sale";
import { SaleCountdown } from "@/features/products/components/sale-countdown";
import { useFeatureFlag } from "@/components/feature-flags";

/**
 * Хэмжээ сонгогчийн ДЭЭРХ үнийн хэсэг (task 15, 2.6) — хэмжээ солиход
 * дагаж шинэчлэгдэнэ: үнэ (хямдралтай бол хямдарсан), зураастай үндсэн үнэ,
 * хувь (`−15%`, `salePct` — картын chip-тэй ижил томьёо), сонгосон хэмжээ,
 * дуусах тоолуур.
 *
 * - Тоолуур нь СОНГОСОН хэмжээнийх, дэлгэрэнгүйд үнийн мөрийн төгсгөлд
 *   жижиг pill (`SaleCountdown variant="pill"`); хямдралгүй хэмжээ сонговол
 *   юу ч үгүй. Сервер зөвхөн ISO өгнө — текст client дээр (туг
 *   `sale_display`).
 * - Layout shift үгүй: утсан дээр (< sm) pill доод мөрөнд орж болох тул
 *   `reserve` үед мөрийн өндрийг 2 мөрөөр урьдчилан хадгална — хэмжээ
 *   сонгогч, товчууд хөдлөхгүй. Хямдралгүй бараанд хадгалахгүй.
 * - Дууссан хэмжээ сонгосон ч үнэ харагдана (task 4).
 * - `aria-live` үнийн мөрөнд; тоолуур `role="timer"` (aria-live off) тул
 *   секунд тутам зарлагдахгүй.
 */
export function SizePrice({
  price,
  basePrice,
  sizeLabel,
  endsAt,
  pct: pctOverride,
  size = "lg",
  reserve = false,
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
  /**
   * Энэ бараа/багцын аль нэг хэмжээ дуусах хугацаатай хямдралтай эсэх —
   * `lg` үед утсан дээр үнийн мөрийн 2 мөрийн өндрийг хадгална (туг
   * `sale_display` нээлттэй үед л — хаалттай бол pill гарахгүй).
   */
  reserve?: boolean;
}) {
  const showEnds = useFeatureFlag("sale_display");
  const pct =
    price < basePrice ? (pctOverride ?? salePct(basePrice, price)) : 0;
  const lg = size === "lg";
  const ends = pct > 0 ? endsAt : null;
  return (
    <div className={lg ? undefined : "space-y-1"}>
      <div
        aria-live="polite"
        data-testid="size-price"
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-1",
          // 2 мөр: text-3xl (36px) + gap 4px + pill (24px).
          lg && reserve && showEnds && "max-sm:min-h-16",
        )}
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
        {/* Хэмжээ солигдох бүрт дахин mount — гарч ирэх анимэйшн. */}
        {lg && (
          <SaleCountdown
            key={sizeLabel ?? ""}
            endsAt={ends}
            variant="pill"
            // sm+: үнийн бүлэг зүүнд, тоолуур баруун захад (space-between).
            // Утсан дээр доод мөрөнд зүүн тийш хэвээр.
            className="self-center sm:ml-auto"
          />
        )}
      </div>
      {/* quick-add: нэг мөрийн жижиг хувилбар хэвээр. */}
      {!lg && <SaleCountdown endsAt={ends} />}
    </div>
  );
}
