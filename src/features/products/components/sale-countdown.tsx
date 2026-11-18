"use client";

import { Clock } from "lucide-react";
import { useFeatureFlag } from "@/components/feature-flags";
import { useNowTick } from "@/components/shared/use-now-tick";
import { formatTimer } from "@/features/sale-events/lib";
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
 * - 0 болоход нуугдана. Үнийг энд өөрчлөхгүй — кэшийг шөнийн cron шинэчилнэ.
 * - `endsAt` хоосон (хугацаагүй хямдрал) эсвэл туг хаалттай бол юу ч үгүй.
 */
export function SaleCountdown({
  endsAt,
  className,
}: {
  endsAt: string | null | undefined;
  className?: string;
}) {
  const on = useFeatureFlag("sale_display");
  if (!on || !endsAt) return null;
  return <Ticking endsAt={endsAt} className={className} />;
}

function Ticking({ endsAt, className }: { endsAt: string; className?: string }) {
  const now = useNowTick();
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return null;
  const text = now == null ? null : formatTimer(end - now);
  // Цаг мэдэгдэж, хугацаа дууссан → нуух.
  if (now != null && text == null) return null;
  return (
    <span
      role="timer"
      aria-hidden={text == null}
      className={cn(
        "text-destructive flex items-center gap-1 text-xs font-medium tabular-nums",
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
