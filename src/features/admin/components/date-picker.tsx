"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useFieldProps } from "@/components/ui/field";
import { Calendar } from "@/features/admin/components/calendar";
import { ubToday } from "@/features/admin/lib/date-range";
import { cn } from "@/lib/utils";

/**
 * A single date, in the panel's own calendar.
 *
 * Drop-in for `<Input type="date">`: same `YYYY-MM-DD` string in and out. The
 * native control was the last place the browser drew its own widget over a
 * themed page, and it read the *viewer's* timezone for "today" — on a laptop
 * set to another zone, the highlighted day was not the shop's day.
 *
 * Sits inside `<Field>` and picks up its label and error wiring, so callers
 * swap the tag and change nothing else.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Огноо сонгох",
  /** Lets the operator clear the date back to empty. */
  clearable = true,
  className,
  ...aria
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
} & React.AriaAttributes & { id?: string }) {
  const fieldProps = useFieldProps(aria);
  const [open, setOpen] = React.useState(false);
  const [today, setToday] = React.useState<string | null>(null);
  // The shop's date, not the browser's.
  React.useEffect(() => setToday(ubToday()), []);

  return (
    <>
      <div className={cn("flex items-center gap-1.5", className)}>
        <button
          type="button"
          {...fieldProps}
          onClick={() => setOpen(true)}
          className={cn(
            "bg-secondary field-edge flex h-11 flex-1 items-center gap-2 rounded-md px-3 text-left text-base md:h-10 md:text-sm",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarDays className="text-muted-foreground size-4 shrink-0" />
          <span className="tabular-nums">{value || placeholder}</span>
        </button>
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Огноо цэвэрлэх"
            onClick={() => onChange("")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {open && (
        <ResponsiveDialog
          open
          onOpenChange={setOpen}
          title="Огноо сонгох"
          className="sm:max-w-sm"
        >
          <Calendar
            start={value}
            today={today}
            onPick={(key) => {
              onChange(key);
              // One tap, one date: unlike a range there is nothing else to
              // wait for, so confirming would just be a second tap.
              setOpen(false);
            }}
          />
          <div className="mt-4 flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={!today}
              onClick={() => {
                onChange(today!);
                setOpen(false);
              }}
            >
              Өнөөдөр
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Болих
            </Button>
          </div>
        </ResponsiveDialog>
      )}
    </>
  );
}
