"use client";

import * as React from "react";
import type { SaleEventTickerTheme } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Арга хэмжээний шүүлтүүрийн chip-ийн төрх — каталогийн шүүлтүүр ба студийн
 * ③ харагдац хоёуланд (төрх зөрөхгүй). Сонгоогүй үед бусад chip-тэй ижил
 * (цул өнгө нь «сонгосон» шиг харагддаг байв). Сонгосон үед арга хэмжээний
 * зурвасны цул өнгө (`[data-ticker]`, globals.css) + дээгүүр нь цайвар туяа
 * (`animate-chip-sweep`; reduced-motion-д зогсоно). CLAUDE.md: URL солих
 * chip-д transition-colors үгүй.
 */
export function eventChipClass(active: boolean): string {
  return active
    ? cn(
        "bg-announce text-announce-chip relative isolate overflow-hidden",
        // Туяа: ::before, текстийн доор (isolate + -z-10), chip-ээс гарахгүй.
        "before:animate-chip-sweep before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/4 before:-z-10 before:w-1/4 before:bg-white/55 before:blur-[2px] before:content-['']",
      )
    : "bg-secondary text-foreground hover:bg-accent";
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
