"use client";

import { cn } from "@/lib/utils";
import { periodSentence, type PeriodSentenceOptions } from "../lib/period";

/**
 * Эхлэх / дуусах өдрийн талбаруудын доорх тайлбар (task 7) — яг хэдэн цагт
 * эхэлж, дуусах, хэдэн хоног, цагийн бүс. Хугацаа сонгодог БҮХ админ
 * маягт үүнийг ашиглана; утга нь `dayStartIso` / `dayEndIso`-оор
 * хадгалагдах ёстой (`periodSentence`-ийн тайлбарыг үз).
 *
 * Өдөр сонгоогүй үед `fallback` (өгөөгүй бол юу ч харуулахгүй).
 */
export function PeriodHint({
  startsOn,
  endsOn,
  today,
  fallback,
  className,
}: {
  startsOn: string;
  endsOn: string;
  fallback?: string;
  className?: string;
} & PeriodSentenceOptions) {
  const text = periodSentence(startsOn, endsOn, { today }) ?? fallback;
  if (!text) return null;
  return (
    <p
      className={cn("text-muted-foreground text-xs text-pretty", className)}
      aria-live="polite"
    >
      {text}
    </p>
  );
}
