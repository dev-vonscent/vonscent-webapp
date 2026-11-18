"use client";

import { Clock } from "lucide-react";
import { useFeatureFlag } from "@/components/feature-flags";
import { useNowTick } from "@/components/shared/use-now-tick";
import { formatTimer, timerParts } from "@/features/sale-events/lib";
import { SALE_COUNTDOWN_URGENT_MS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Хямдрал дуусах тоолуур «7 өдөр 16:45:32» (task 2.2, туг `sale_display`).
 * Каталогийн карт, дараа нь барааны дэлгэрэнгүй (2.6) — сонгосон хэмжээний
 * `endsAt`-ийг дамжуулахад л болно.
 *
 * - Сервер зөвхөн ISO мөчийг өгнө; текст ЗӨВХӨН браузер дээр (`useNowTick`).
 *   SSR/hydration-д мөрийн зай л (invisible) — ISR HTML тогтмол, layout
 *   үсрэхгүй.
 * - Бүх тоолуур нэг дундын секундийн tick-ийг хуваалцана.
 * - 24 цагаас их үлдсэн бол саармаг, ≤ 24 цаг бол улаан
 *   (`SALE_COUNTDOWN_URGENT_MS`) — төлөв нь зөвхөн client-ийн цагаас; SSR-д
 *   саармаг (харагдахгүй) зай л. Босго давахад тэр tick-д шууд солигдоно.
 * - 0 болоход нуугдана. Үнийг энд өөрчлөхгүй — кэшийг шөнийн cron шинэчилнэ.
 * - `endsAt` хоосон (хугацаагүй хямдрал) эсвэл туг хаалттай бол юу ч үгүй.
 */
export function SaleCountdown({
  endsAt,
  className,
  variant = "inline",
}: {
  endsAt: string | null | undefined;
  className?: string;
  /**
   * `inline` — каталогийн карт, quick-add (нэг мөр); `pill` — барааны /
   * багцын дэлгэрэнгүйн үнийн мөрийн төгсгөлд.
   */
  variant?: "inline" | "pill";
}) {
  const on = useFeatureFlag("sale_display");
  if (!on || !endsAt) return null;
  return variant === "pill" ? (
    <Pill endsAt={endsAt} className={className} />
  ) : (
    <Ticking endsAt={endsAt} className={className} />
  );
}

/**
 * Тоолуурын aria-label: «Хямдрал дуусахад 3 өдөр 11 цаг», нэг өдрөөс бага
 * бол «11 цаг 39 мин», нэг цагаас бага бол «39 мин» — секунд тутам
 * өөрчлөгдөхгүй.
 */
export function countdownLabel(parts: {
  days: number;
  hh: string;
  mm: string;
}): string {
  const h = Number(parts.hh);
  const m = Number(parts.mm);
  const rest =
    parts.days > 0
      ? `${parts.days} өдөр ${h} цаг`
      : h > 0
        ? `${h} цаг ${m} мин`
        : `${m} мин`;
  return `Хямдрал дуусахад ${rest}`;
}

/**
 * Дэлгэрэнгүйн үнийн мөрийн төгсгөлд жижиг pill «⏱ 3 өдөр 11:39:18».
 * Гарчиггүй — утга нь aria-label-д. Дүрэм нь `Ticking`-тэй ижил (client-only,
 * дундын tick, 0 болоход нуугдана); SSR-д `invisible` хоосон бүрхүүл.
 * > 24ц: `bg-muted`, тоо `text-foreground`, icon `text-sale`; ≤ 24ц: бүхэлдээ
 * `bg-sale text-sale-foreground`. Өнгө солигдоход transition үгүй; зөвхөн
 * гарч ирэх (opacity/transform) ба icon-ы хөдөлгөөн, `motion-safe:`.
 */
function Pill({ endsAt, className }: { endsAt: string; className?: string }) {
  const now = useNowTick();
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return null;
  const left = now == null ? null : end - now;
  const parts = left == null ? null : timerParts(left);
  if (now != null && parts == null) return null;
  const urgent = left != null && left <= SALE_COUNTDOWN_URGENT_MS;
  const text =
    parts == null
      ? null
      : `${parts.days > 0 ? `${parts.days} өдөр ` : ""}${parts.hh}:${parts.mm}:${parts.ss}`;
  return (
    <span
      role="timer"
      aria-live="off"
      aria-hidden={parts == null}
      aria-label={parts == null ? undefined : countdownLabel(parts)}
      data-urgent={urgent || undefined}
      data-variant="pill"
      className={cn(
        "motion-safe:animate-sale-pill-in inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium whitespace-nowrap tabular-nums",
        urgent ? "bg-sale text-sale-foreground" : "bg-muted text-foreground",
        parts == null && "invisible",
        className,
      )}
    >
      <Clock
        aria-hidden
        className={cn(
          "motion-safe:animate-sale-clock size-3.5 shrink-0",
          !urgent && "text-sale",
        )}
      />
      <span aria-hidden>{text ?? " "}</span>
    </span>
  );
}

function Ticking({
  endsAt,
  className,
}: {
  endsAt: string;
  className?: string;
}) {
  const now = useNowTick();
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return null;
  const left = now == null ? null : end - now;
  const text = left == null ? null : formatTimer(left);
  // Цаг мэдэгдэж, хугацаа дууссан → нуух.
  if (now != null && text == null) return null;
  const urgent = left != null && left <= SALE_COUNTDOWN_URGENT_MS;
  return (
    <span
      role="timer"
      aria-hidden={text == null}
      data-urgent={urgent || undefined}
      // transition-colors үгүй — босго давахад өнгө шууд солигдоно.
      // `className` сүүлд: бараан зурган дээрх цагаан хувилбар давамгайлна.
      className={cn(
        "flex items-center gap-1 text-xs font-medium tabular-nums",
        urgent ? "text-destructive" : "text-muted-foreground",
        text == null && "invisible",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">Хямдрал дуусахад </span>
      {/* SSR-д хоосон — зайг ижил өндөртэй тэмдэгтээр барина. */}
      <span>{text ?? " "}</span>
    </span>
  );
}
