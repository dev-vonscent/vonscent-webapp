"use client";

import * as React from "react";
import type { SaleEventTickerTheme } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Арга хэмжээний шүүлтүүрийн chip-ийн төрх — каталогийн шүүлтүүр ба студийн
 * ③ харагдац хоёуланд (төрх зөрөхгүй). Бусад chip саарал байхад энэ нь арга
 * хэмжээний зурвасны цул өнгөтэй (`[data-ticker]`, globals.css) бөгөөд дээгүүр
 * нь цайвар туяа гүйнэ (`animate-chip-sweep`; reduced-motion-д зогсоно).
 * Сонгосон үед зурвасны өнгийн хүрээ — өнгө солигдохгүй тул анивчихгүй
 * (CLAUDE.md: URL солих chip-д transition-colors үгүй).
 */
export function eventChipClass(active: boolean): string {
  return cn(
    "bg-announce text-announce-chip relative isolate overflow-hidden",
    // Туяа: ::before, текстийн доор (isolate + -z-10), chip-ээс гарахгүй.
    "before:animate-chip-sweep before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/4 before:-z-10 before:w-1/4 before:bg-white/55 before:blur-[2px] before:content-['']",
    active && "ring-announce ring-offset-background ring-2 ring-offset-2",
  );
}

export function EventFilterChip({
  theme,
  active,
  onClick,
  className,
  children,
}: {
  theme: SaleEventTickerTheme;
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-ticker={theme}
      className={cn(
        "truncate rounded-sm px-3 py-2 text-center text-sm font-medium",
        eventChipClass(active),
        className,
      )}
    >
      {children}
    </button>
  );
}
