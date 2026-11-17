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
    // `aria-live` ЗОРИУД байхгүй: Radix-ийн `hideOthers` live region-тэй
    // элементийг aria-hidden болгодоггүй тул drawer дотор байхад огнооны
    // dialog нээгдэхэд drawer a11y-д харагдсаар үлддэг байв (e2e
    // admin-coupon-create «дуусах огноо сонгогч»).
    <p className={cn("text-muted-foreground text-xs text-pretty", className)}>
      {text}
    </p>
  );
}
