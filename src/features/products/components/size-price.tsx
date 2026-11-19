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
   * `lg` үед утсан дээр үнийн мөрийн 2 мөрийн өндрийг, `sm` (quick-add) үед
   * тоолуурын мөрийг хадгална (туг
   * `sale_display` нээлттэй үед л — хаалттай бол pill гарахгүй).
   */
  reserve?: boolean;
}) {
  const showEnds = useFeatureFlag("sale_display");
  const pct =
    price < basePrice ? (pctOverride ?? salePct(basePrice, price)) : 0;
  const lg = size === "lg";
  const ends = pct > 0 ? endsAt : null;
  // Дэлгэрэнгүй (lg): үнэ нь хуудасны гол тоо — том, нягт; хэмнэлт (хувь +
  // зураастай үнэ) түүний хажууд нэг блок болж бэхэлнэ, хэмжээ доор нь.
  // Тоолуур sm+ үед баруун захад, утсан дээр доод мөрөнд.
  if (lg) {
    return (
      <div
        aria-live="polite"
        data-testid="size-price"
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-3",
          // 2 мөр: үнэ (32px) + gap 12px + pill (24px).
          reserve && showEnds && "max-sm:min-h-17",
        )}
      >
        <div className="flex items-stretch gap-3">
          <span className="font-serif text-[2rem]/none font-semibold tracking-tight tabular-nums sm:text-4xl/none">
            {formatPrice(price)}
          </span>
          {(pct > 0 || sizeLabel) && (
            <span className="flex flex-col justify-between gap-1 py-0.5">
              {pct > 0 && (
                <span className="flex items-center gap-2">
                  {/* `sale` token — бүх theme-д ижил, цагаан тоотой (6.5:1). */}
                  <span
                    data-testid="size-price-pct"
                    className="bg-sale text-sale-foreground rounded-full px-2 py-0.5 text-sm/none font-semibold tabular-nums"
                  >
                    −{pct}%
                  </span>
                  <span className="text-muted-foreground text-sm/none tabular-nums line-through">
                    {formatPrice(basePrice)}
                  </span>
                </span>
              )}
              {sizeLabel && (
                <span className="text-muted-foreground mt-auto text-sm/none">
                  / {sizeLabel}
                </span>
              )}
            </span>
          )}
        </div>
        {/* Хэмжээ солигдох бүрт дахин mount — гарч ирэх анимэйшн. */}
        <SaleCountdown
          key={sizeLabel ?? ""}
          endsAt={ends}
          variant="pill"
          className="sm:ml-auto"
        />
      </div>
    );
  }

  // quick-add (sm): нэг мөрийн жижиг хувилбар.
  return (
    <div className="space-y-1">
      <div
        aria-live="polite"
        data-testid="size-price"
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
      >
        <span className="font-semibold tracking-tight tabular-nums">
          {formatPrice(price)}
        </span>
        {pct > 0 && (
          <>
            <span className="text-muted-foreground text-xs tabular-nums line-through">
              {formatPrice(basePrice)}
            </span>
            {/* `sale` token — бүх theme-д ижил. Бараан улаан нь хар
                дэвсгэр дээр текст болж уншигдахгүй (3:1) тул цагаан тоотой
                жижиг pill (6.5:1). */}
            <span
              data-testid="size-price-pct"
              className="bg-sale text-sale-foreground self-center rounded-full px-1.5 py-0.5 text-xs leading-none font-semibold tabular-nums"
            >
              −{pct}%
            </span>
          </>
        )}
        {sizeLabel && (
          <span className="text-muted-foreground text-xs">/ {sizeLabel}</span>
        )}
      </div>
      {/* `reserve` үед мөрийн өндөр (16px) үргэлж хадгалагдана — хямдралтай
          хэмжээ сонгоход цонх хөдлөхгүй. */}
      {reserve && showEnds ? (
        <div className="min-h-4" data-testid="size-price-countdown-slot">
          <SaleCountdown endsAt={ends} />
        </div>
      ) : (
        <SaleCountdown endsAt={ends} />
      )}
    </div>
  );
}
