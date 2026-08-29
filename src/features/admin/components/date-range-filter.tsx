"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Calendar } from "@/features/admin/components/calendar";
import { cn } from "@/lib/utils";
import {
  DATE_PRESETS,
  activePreset,
  dateKeyOf,
  timeOf,
  ubToday,
} from "@/features/admin/lib/date-range";

/**
 * Date range for the order list.
 *
 * Two `<input type="datetime-local">` boxes used to sit here, which meant the
 * browser drew its own grey calendar over a themed page — one of the few
 * surfaces in the panel that ignored all three themes — and, worse, "show me
 * today's orders" cost two typed datetimes. The common ranges are now one tap;
 * the calendar is only for the rare exact range, and it is ours.
 *
 * The URL contract is unchanged (`from` / `to` as `YYYY-MM-DDTHH:mm`), so the
 * page's `+08:00` pinning and the Supabase query are untouched.
 */
export function DateRangeFilter({
  from,
  to,
  /**
   * Every other filter currently in the URL. Plain data, not a callback: a
   * server component cannot hand a function to a client one, and the range
   * must not drop the operator's status chip or search term.
   */
  params,
}: {
  from?: string;
  to?: string;
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Ulaanbaatar's today, not the laptop's: an operator abroad must still see
  // the same "Өнөөдөр" as the shop.
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => setToday(ubToday()), []);

  const current = today ? activePreset(from, to, today) : "all";

  function apply(range: { from?: string; to?: string }) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({
      ...params,
      ...range,
      // Any change of range starts the result set again; page 3 of the old
      // range means nothing in the new one.
      page: undefined,
    })) {
      if (v) next.set(k, v);
    }
    const qs = next.toString();
    router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {DATE_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={current === p.id}
          // Until the effect has run we don't know the shop's date, and a chip
          // that computes the wrong range is worse than one that waits.
          disabled={!today}
          onClick={() => apply(p.range(today!) ?? { from: undefined, to: undefined })}
          className={cn(
            "min-h-11 rounded-full px-3.5 text-xs font-medium transition-colors disabled:opacity-50 md:min-h-9",
            current === p.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}

      <button
        type="button"
        aria-pressed={current === "custom"}
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors md:min-h-9",
          current === "custom"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground",
        )}
      >
        <CalendarDays className="size-3.5" />
        {current === "custom" ? rangeLabel(from, to) : "Тодорхой хугацаа"}
      </button>

      {open && (
        <RangeDialog
          open
          onOpenChange={setOpen}
          from={from}
          to={to}
          today={today}
          onApply={(r) => {
            setOpen(false);
            apply(r);
          }}
        />
      )}
    </div>
  );
}

function rangeLabel(from?: string, to?: string): string {
  const a = dateKeyOf(from);
  const b = dateKeyOf(to);
  if (a && b) return a === b ? a : `${a} — ${b}`;
  if (a) return `${a}-с хойш`;
  if (b) return `${b} хүртэл`;
  return "Тодорхой хугацаа";
}

function RangeDialog({
  open,
  onOpenChange,
  from,
  to,
  today,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  from?: string;
  to?: string;
  today: string | null;
  onApply: (r: { from?: string; to?: string }) => void;
}) {
  const [start, setStart] = React.useState(dateKeyOf(from));
  const [end, setEnd] = React.useState(dateKeyOf(to));
  const [startTime, setStartTime] = React.useState(timeOf(from, "00:00"));
  const [endTime, setEndTime] = React.useState(timeOf(to, "23:59"));

  /**
   * One click sets the start and clears the end; the next sets the end. A
   * click before the current start restarts the range rather than producing an
   * inverted one the query would silently return nothing for.
   */
  function pick(key: string) {
    if (!start || (start && end) || key < start) {
      setStart(key);
      setEnd("");
      return;
    }
    setEnd(key);
  }

  const effectiveEnd = end || start;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Хугацаа сонгох"
      description="Эхлэх өдрөө дараад, дараа нь дуусах өдрөө дарна."
      className="sm:max-w-md"
    >
      <div className="space-y-4">
        <Calendar start={start} end={end} today={today} onPick={pick} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Эхлэх цаг">
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field label="Дуусах цаг">
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>

        <p className="text-muted-foreground text-xs">
          {start
            ? `${start} ${startTime} — ${effectiveEnd} ${endTime} хооронд ирсэн захиалга.`
            : "Хуанлиас өдөр сонгоно уу."}
        </p>

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onApply({ from: undefined, to: undefined })}
          >
            Цэвэрлэх
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Болих
            </Button>
            <Button
              type="button"
              disabled={!start}
              onClick={() =>
                onApply({
                  from: `${start}T${startTime}`,
                  to: `${effectiveEnd}T${endTime}`,
                })
              }
            >
              Шүүх
            </Button>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
