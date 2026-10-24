"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type SegmentedTab<T extends string> = {
  value: T;
  label: string;
  /** Утсан дээрх богино нэр — табууд тэнцүү өргөнтэй тул урт нэр багтахгүй. */
  short?: string;
  count?: number;
};

/**
 * Тэнцүү өргөнтэй segmented таб — идэвхтэй дэвсгэр нь шинэ таб руу гулсаж
 * шилждэг (`layoutId`). Купон, захиалгын хуудас хоёулаа үүнийг хэрэглэнэ.
 *
 * Төлөв нь клиент дээр (`onChange`) — серверт хүсэлт явуулдаг линк таб
 * шилжилтийг удаашруулдаг тул өгөгдлөө нэг удаа аваад энд шүүнэ.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `aria-label` — табын мөр юуг ангилж буйг. */
  label: string;
  className?: string;
}) {
  const id = React.useId();
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "bg-secondary flex gap-1 rounded-xl p-1 text-xs sm:text-sm",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex-1 rounded-lg px-1 py-1.5 text-center font-medium whitespace-nowrap transition-colors sm:px-3",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${id}`}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0.15, duration: 0.35 }
                }
                className="bg-background absolute inset-0 rounded-lg shadow-sm"
                aria-hidden
              />
            )}
            <span className="relative">
              {t.short ? (
                <>
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              ) : (
                t.label
              )}
              {t.count != null && t.count > 0 && (
                <span className="text-muted-foreground ml-1 tabular-nums">
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
