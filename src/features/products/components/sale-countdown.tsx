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
   * `inline` — каталогийн карт, quick-add (нэг мөр); `boxes` — барааны /
   * багцын дэлгэрэнгүй (гарчиг + өдөр/цаг/мин/сек тусдаа хайрцаг).
   */
  variant?: "inline" | "boxes";
}) {
  const on = useFeatureFlag("sale_display");
  if (!on || !endsAt) return null;
  return variant === "boxes" ? (
    <Boxes endsAt={endsAt} className={className} />
  ) : (
    <Ticking endsAt={endsAt} className={className} />
  );
}

const BOX_UNITS = [
  { key: "days", label: "өдөр" },
  { key: "hh", label: "цаг" },
  { key: "mm", label: "мин" },
  { key: "ss", label: "сек" },
] as const;

/**
 * Дэлгэрэнгүйн том тоолуур. Дүрэм нь `Ticking`-тэй ижил (client-only,
 * дундын tick, 0 болоход нуугдана). SSR/hydration-д бүтэц нь бүтнээрээ
 * `invisible` — тоо HTML-д орохгүй, өндөр нь урьдчилан тогтмол.
 * > 24ц: хайрцаг `bg-muted`, тоо `text-foreground`, гарчиг/icon улаан;
 * ≤ 24ц: бүхэлдээ `destructive`.
 */
function Boxes({ endsAt, className }: { endsAt: string; className?: string }) {
  const now = useNowTick();
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return null;
  const left = now == null ? null : end - now;
  const parts = left == null ? null : timerParts(left);
  if (now != null && parts == null) return null;
  const urgent = left != null && left <= SALE_COUNTDOWN_URGENT_MS;
  return (
    <div
      role="timer"
      aria-hidden={parts == null}
      aria-label={
        parts == null
          ? undefined
          : `Хямдрал дуусахад ${parts.days} өдөр ${parts.hh}:${parts.mm}:${parts.ss}`
      }
      data-urgent={urgent || undefined}
      className={cn("space-y-2", parts == null && "invisible", className)}
    >
      <p className="text-destructive flex items-center gap-1.5 text-sm font-medium">
        <Clock className="size-4 shrink-0" aria-hidden />
        Хямдрал дуусахад
      </p>
      {/* aria-hidden — секунд тутмын өөрчлөлт уншигдахгүй; утгыг timer-ийн
          aria-label өгнө. */}
      <div className="grid max-w-80 grid-cols-4 gap-2" aria-hidden>
        {BOX_UNITS.map((u) => (
          <div
            key={u.key}
            className={cn(
              "flex flex-col items-center rounded-lg px-1 py-2",
              urgent ? "bg-destructive/10" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "block h-8 text-2xl/8 font-semibold tabular-nums",
                urgent ? "text-destructive" : "text-foreground",
              )}
            >
              {parts ? String(parts[u.key]) : " "}
            </span>
            <span
              className={cn(
                "text-xs",
                urgent ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {u.label}
            </span>
          </div>
        ))}
      </div>
    </div>
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
