"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  monthGrid,
} from "@/features/admin/lib/date-range";

const MIN_YEAR = 1900;
/** Хоосон үед эхлэх он — 1900 оноос доош гүйлгэлгүй ихэнх хэрэглэгчид ойр. */
const DEFAULT_YEAR = 2000;

type View = "year" | "month" | "day";

/**
 * Төрсөн өдөр сонгох календарь: он → сар → өдөр.
 *
 * Browser-ийн `type="date"` нь өнөөдрөөс эхэлдэг тул 30 жилийн өмнөх
 * өдөр рүү сар сараар ухрах хэрэгтэй болдог, theme-д ч захирагддаггүй.
 * Энд хоосон үед эхлээд он, дараа нь сар, тэгээд өдрийн хүснэгт гарна;
 * гарчиг дээр дарж аль ч алхам руу буцна. `YYYY-MM-DD` мөр орж гарна.
 */
export function BirthdayPicker({
  value,
  onChange,
  max,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Сонгож болох хамгийн сүүлийн өдөр (`YYYY-MM-DD`). */
  max: string;
  invalid?: boolean;
}) {
  const maxYear = Number(max.slice(0, 4));
  const maxMonth = Number(max.slice(5, 7)) - 1;
  const [view, setView] = React.useState<View>(value ? "day" : "year");
  const [cursor, setCursor] = React.useState(() => ({
    year: value ? Number(value.slice(0, 4)) : Math.min(DEFAULT_YEAR, maxYear),
    month: value ? Number(value.slice(5, 7)) - 1 : 0,
  }));

  const pickedYear = value ? Number(value.slice(0, 4)) : null;
  const pickedMonth = value ? Number(value.slice(5, 7)) - 1 : null;

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }
  const canPrev = cursor.year > MIN_YEAR || cursor.month > 0;
  const canNext =
    cursor.year < maxYear ||
    (cursor.year === maxYear && cursor.month < maxMonth);

  return (
    <div
      className={cn(
        "bg-secondary space-y-3 rounded-xl p-3",
        invalid && "field-edge-error",
      )}
    >
      {/* Гарчиг: он, сар нь товч — дарж тухайн алхам руу шилжинэ. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <HeaderButton
            active={view === "year"}
            onClick={() => setView(view === "year" ? "day" : "year")}
          >
            {cursor.year}
          </HeaderButton>
          <HeaderButton
            active={view === "month"}
            onClick={() => setView(view === "month" ? "day" : "month")}
          >
            {MONTH_NAMES[cursor.month]}
          </HeaderButton>
        </div>
        {view === "day" && (
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Өмнөх сар"
              disabled={!canPrev}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Дараах сар"
              disabled={!canNext}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {view === "year" && (
        <YearGrid
          current={cursor.year}
          picked={pickedYear}
          maxYear={maxYear}
          onPick={(year) => {
            setCursor((c) => ({
              year,
              month: year === maxYear ? Math.min(c.month, maxMonth) : c.month,
            }));
            setView("month");
          }}
        />
      )}

      {view === "month" && (
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, month) => {
            const disabled = cursor.year === maxYear && month > maxMonth;
            const selected =
              pickedYear === cursor.year && pickedMonth === month;
            return (
              <Cell
                key={name}
                selected={selected}
                disabled={disabled}
                className="h-12"
                onClick={() => {
                  setCursor((c) => ({ ...c, month }));
                  setView("day");
                }}
              >
                {name}
              </Cell>
            );
          })}
        </div>
      )}

      {view === "day" && (
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
          {monthGrid(cursor.year, cursor.month).map((key, i) =>
            key ? (
              <Cell
                key={key}
                selected={key === value}
                disabled={key > max}
                aria-label={key}
                className="h-10 tabular-nums"
                onClick={() => onChange(key)}
              >
                {Number(key.slice(8))}
              </Cell>
            ) : (
              <div key={`pad-${i}`} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function YearGrid({
  current,
  picked,
  maxYear,
  onPick,
}: {
  current: number;
  picked: number | null;
  maxYear: number;
  onPick: (year: number) => void;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  // Шинээс хуучин руу — ихэнх хэрэглэгчийн он дээд хэсэгт ойр байна.
  const years = React.useMemo(
    () => Array.from({ length: maxYear - MIN_YEAR + 1 }, (_, i) => maxYear - i),
    [maxYear],
  );

  // Нээгдэхэд идэвхтэй оныг голд нь гаргана.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-year="${current}"]`);
    if (!list || !el) return;
    list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    // Зөвхөн нээгдэх үед — сонгох бүрт үсрэхгүй.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={listRef}
      className="relative grid max-h-64 grid-cols-4 gap-2 overflow-y-auto overscroll-contain"
    >
      {years.map((year) => (
        <Cell
          key={year}
          data-year={year}
          selected={year === picked}
          current={year === current && year !== picked}
          className="h-11 tabular-nums"
          onClick={() => onPick(year)}
        >
          {year}
        </Cell>
      ))}
    </div>
  );
}

function HeaderButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onClick}
      className={cn(
        "hover:bg-accent flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-medium tabular-nums transition-colors",
        active && "bg-accent",
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          "text-muted-foreground size-3.5 transition-transform",
          active && "rotate-180",
        )}
      />
    </button>
  );
}

function Cell({
  selected,
  current,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  selected?: boolean;
  /** Сонгоогүй ч одоо харж буй он — хүрээгээр тэмдэглэнэ. */
  current?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-center rounded-md text-sm transition-colors disabled:pointer-events-none disabled:opacity-30",
        selected ? "bg-cta text-cta-foreground font-medium" : "hover:bg-accent",
        current && "ring-foreground/30 ring-1 ring-inset",
        className,
      )}
      {...props}
    />
  );
}
