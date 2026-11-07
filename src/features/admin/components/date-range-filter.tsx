"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Calendar } from "@/features/admin/components/calendar";
import { cn } from "@/lib/utils";
import {
  DATE_PRESETS,
  REPORT_DATE_PRESETS,
  activePreset,
  dateKeyOf,
  presetIsAmbiguous,
  timeOf,
  ubToday,
} from "@/features/admin/lib/date-range";

/**
 * Date range for the order list — and, since 0074, for the report page too.
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
  /** Аль хуудас руу шилжих вэ. Өмнө нь `/admin/orders` гэж хатуу бичигдсэн. */
  basePath = "/admin/orders",
  /**
   * Аль багц preset хэрэглэх вэ. Массивыг нь ШУУД дамжуулж болохгүй: preset
   * бүр `range()` функцтэй бөгөөд серверийн компонентоос клиент рүү функц
   * дамжихгүй («Functions cannot be passed directly to Client Components»).
   * Тиймээс нэрийг нь дамжуулж, массивыг энд сонгоно.
   */
  presetSet = "orders",
}: {
  from?: string;
  to?: string;
  params: Record<string, string | undefined>;
  basePath?: string;
  presetSet?: "orders" | "reports";
}) {
  const presets = presetSet === "reports" ? REPORT_DATE_PRESETS : DATE_PRESETS;
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Ulaanbaatar's today, not the laptop's: an operator abroad must still see
  // the same "Өнөөдөр" as the shop.
  //
  // Сервер ч УБ-ын өдрийг өөрөө тооцно (`ubToday` нь цагийн бүсээ заадаг) —
  // өмнө нь серверт `null` байсан тул хугацаатай URL-ийг ачаалах бүрд эхний
  // frame-д бүх chip disabled + «Бүх хугацаа» асаж анивчдаг байв. Шөнө дундын
  // ховор зөрүүг `useSyncExternalStore` hydration-ий дараа өөрөө засна.
  const today: string | null = React.useSyncExternalStore(
    subscribeNever,
    ubToday,
    ubToday,
  );

  // `preset` нь зөвхөн хоёр preset ижил муж гаргах өдөр URL-д бичигдэнэ
  // (`presetIsAmbiguous`) — тэр үед дарсан chip-ийг нь асаана.
  const hint = useSearchParams().get("preset");
  const settled = today ? activePreset(from, to, today, presets, hint) : "all";
  // Дарсан chip шууд асч, URL яг ОЧИХ ёстой утгандаа хүрэх хүртэл ассан
  // хэвээр байна. «URL өөрчлөгдмөгц мартах» нь хангалтгүй байв: давхцсан
  // шилжилтийн үед App Router хуучин/завсрын RSC хариуг түр render хийдэг
  // (vercel/next.js#70977, nuqs#714) тул A chip хэдэн frame асдаг. Зорилтот
  // түлхүүр таарахаас бусад бүх завсрын утгыг үл тоомсорлоно.
  const urlKey = presetKey(from, to, hint);
  const [pending, setPending] = React.useState<{
    id: string;
    target: string;
  } | null>(null);
  if (pending && pending.target === urlKey) setPending(null);
  const current = pending ? pending.id : settled;

  // Browser-ийн back/forward нь бидний зорилтыг хүчингүй болгоно — эс бөгөөс
  // pending нь өөр URL дээр гацна.
  React.useEffect(() => {
    const clear = () => setPending(null);
    window.addEventListener("popstate", clear);
    return () => window.removeEventListener("popstate", clear);
  }, []);

  function apply(
    range: { from?: string; to?: string; preset?: string },
    id: string,
  ) {
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
    const href = qs ? `${basePath}?${qs}` : basePath;
    // Ижил URL руу push хийвэл URL солигдохгүй тул pending хэзээ ч арилахгүй —
    // тийм үед юу ч хийх шаардлагагүй.
    if (href === `${window.location.pathname}${window.location.search}`) return;
    setPending({ id, target: presetKey(range.from, range.to, range.preset) });
    router.push(href);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-busy={pending !== null}
    >
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={current === p.id}
          // Until the effect has run we don't know the shop's date, and a chip
          // that computes the wrong range is worse than one that waits.
          disabled={!today}
          onClick={() =>
            apply(
              {
                ...(p.range(today!) ?? { from: undefined, to: undefined }),
                preset: presetIsAmbiguous(p.id, today!, presets)
                  ? p.id
                  : undefined,
              },
              p.id,
            )
          }
          className={cn(
            "min-h-11 rounded-full px-3.5 text-xs font-medium disabled:opacity-50 md:min-h-9",
            // `transition-colors` санаатай БАЙХГҮЙ: background-color-ийн
            // transition main thread дээр явдаг тул шинэ тайланг render хийх
            // үе давхцвал хуучин chip хагас цагаанаар гацаж «анивчдаг» байв
            // (Playwright-аар frame бүрээр барьсан). Сонголт шууд солигдоно.
            // `cta`, `primary` биш: хар theme-д primary (#262626) нь secondary
            // (#1c1c1c)-оос бараг ялгагдахгүй тул сонгосон chip харагддаггүй
            // байв. cta нь хар дээр цагаан, бусад theme-д primary-тэй ижил.
            current === p.id
              ? "bg-cta text-cta-foreground"
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
          "flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium md:min-h-9",
          current === "custom"
            ? "bg-cta text-cta-foreground"
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
            apply(
              { ...r, preset: undefined },
              r.from || r.to ? "custom" : "all",
            );
          }}
        />
      )}
    </div>
  );
}

/** URL-ийн хугацааг харьцуулах түлхүүр (`from|to|preset`). */
function presetKey(
  from: string | undefined,
  to: string | undefined,
  preset: string | null | undefined,
): string {
  return `${from ?? ""}|${to ?? ""}|${preset ?? ""}`;
}

/** Өдөр солигдохыг дагах шаардлагагүй — хуудас дахин ачаалахад шинэчлэгдэнэ. */
function subscribeNever(): () => void {
  return () => {};
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
