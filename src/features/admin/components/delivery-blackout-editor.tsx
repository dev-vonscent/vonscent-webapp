"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DELIVERY_BLACKOUT_ADMIN_DAYS } from "@/lib/delivery-blackout";
import { formatDeliveryDay, ubDayFromNow } from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

interface Month {
  key: string;
  label: string;
  /** Даваагаас эхэлсэн 7 багана — эхний хоосон нүд null. */
  cells: (string | null)[];
}

/** "yyyy-MM-dd" → 0 = Даваа … 6 = Ням (цагийн бүсээс хамаарахгүй). */
function mondayIndex(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function buildMonths(days: string[]): Month[] {
  const months: Month[] = [];
  for (const day of days) {
    const key = day.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.key !== key) {
      month = {
        key,
        label: `${day.slice(0, 4)} оны ${Number(day.slice(5, 7))}-р сар`,
        cells: Array.from({ length: mondayIndex(day) }, () => null),
      };
      months.push(month);
    }
    month.cells.push(day);
  }
  return months;
}

/**
 * Хүргэлт хийхгүй өдрүүдийг хуанлиас товшиж сонгоно. Маргаашаас
 * DELIVERY_BLACKOUT_ADMIN_DAYS хоног урагш — өнгөрсөн өдөр хадгалахад
 * автоматаар цэвэрлэгдэнэ.
 */
export function DeliveryBlackoutEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (days: string[]) => void;
}) {
  // Mount-ийн дараа бодогдоно — сервер, браузарын өдөр зөрвөл hydration
  // зөрчилдөнө (checkout-ийн хүргэх өдрийн жагсаалттай ижил).
  const [days, setDays] = React.useState<string[]>([]);
  React.useEffect(() => {
    setDays(
      Array.from({ length: DELIVERY_BLACKOUT_ADMIN_DAYS }, (_, i) =>
        ubDayFromNow(i + 1),
      ),
    );
  }, []);
  const months = React.useMemo(() => buildMonths(days), [days]);
  const selected = React.useMemo(() => new Set(value), [value]);
  const upcoming = value.filter((d) => days.length === 0 || d >= days[0]);

  function toggle(day: string) {
    onChange(
      selected.has(day)
        ? value.filter((d) => d !== day)
        : [...value, day].sort(),
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => (
          <div key={m.key} className="space-y-2">
            <p className="text-sm font-medium">{m.label}</p>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-muted-foreground text-[11px]">
                  {w}
                </span>
              ))}
              {m.cells.map((day, i) =>
                day ? (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggle(day)}
                    aria-pressed={selected.has(day)}
                    aria-label={formatDeliveryDay(day)}
                    className={cn(
                      "focus-visible:ring-ring aspect-square rounded-md text-sm tabular-nums outline-none focus-visible:ring-2",
                      selected.has(day)
                        ? "bg-cta text-cta-foreground font-medium"
                        : "bg-secondary hover:bg-accent",
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                ) : (
                  <span key={`pad-${i}`} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {upcoming.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              Хаагдсан өдөр:{" "}
              <span className="font-medium tabular-nums">
                {upcoming.length}
              </span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
            >
              Бүгдийг арилгах
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {upcoming.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                className="bg-secondary hover:bg-accent inline-flex items-center gap-1 rounded-full py-1 pr-2 pl-3 text-xs"
                aria-label={`${formatDeliveryDay(day)} — нээх`}
              >
                {formatDeliveryDay(day)}
                <X className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Хаагдсан өдөр алга — бүх өдөр хүргэлттэй.
        </p>
      )}
    </div>
  );
}
