"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  monthGrid,
} from "@/features/admin/lib/date-range";

/**
 * One month grid, Monday-first, in Mongolian.
 *
 * Shared by the order list's range filter and the single-date fields, so a
 * calendar looks and behaves the same everywhere in the panel. Days are real
 * buttons in a grid: the browser's own date widget was the only control here
 * that ignored all three themes, and replacing it with something unfocusable
 * would have traded one problem for a worse one.
 *
 * Dates are `YYYY-MM-DD` strings throughout — no `Date` objects cross this
 * boundary, so nothing can silently shift a day by a timezone.
 */
export function Calendar({
  /** Selected day, or the range start. */
  start,
  /** Range end. Omit for single-date selection. */
  end,
  onPick,
  /** Highlighted as "today"; pass the shop's date, not the browser's. */
  today,
}: {
  start: string;
  end?: string;
  onPick: (dateKey: string) => void;
  today?: string | null;
}) {
  const anchor = start || today || todayFallback();
  const [view, setView] = React.useState(() => ({
    year: Number(anchor.slice(0, 4)),
    month: Number(anchor.slice(5, 7)) - 1,
  }));

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const cells = monthGrid(view.year, view.month);
  const rangeEnd = end || start;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Өмнөх сар"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span aria-live="polite" className="text-sm font-medium">
          {view.year} · {MONTH_NAMES[view.month]}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Дараах сар"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_NAMES.map((w) => (
          <div
            key={w}
            aria-hidden
            className="text-muted-foreground pb-1 text-center text-[11px] font-medium"
          >
            {w}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} />;
          const isStart = key === start;
          const isEnd = key === rangeEnd;
          const inRange = start && rangeEnd && key > start && key < rangeEnd;
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-pressed={isStart || isEnd}
              aria-label={key}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "flex h-10 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                isStart || isEnd
                  ? "bg-primary text-primary-foreground font-medium"
                  : inRange
                    ? "bg-secondary text-foreground"
                    : "hover:bg-muted",
                // Today is marked but never painted like a selection, or the
                // operator reads it as already chosen.
                isToday && !isStart && !isEnd && "text-gold-strong font-medium",
              )}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Only reached when neither a selection nor the shop's date is known yet. */
function todayFallback(): string {
  return new Date().toISOString().slice(0, 10);
}
