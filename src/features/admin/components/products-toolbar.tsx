"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Boxes } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Search / filter / sort for the admin product list (A2). State lives in the
 * URL so the server component filters and the view survives refresh and back.
 *
 * Visibility and stock are two independent questions and used to share one
 * «Төлөв» dropdown, which made them mutually exclusive: "published but sold
 * out" — the single most urgent row in the catalogue — could not be asked for
 * at all. Worse, that dropdown's «Үлдэгдэл бага» sat next to the sort
 * dropdown's «Үлдэгдэл багаас», two controls that read as the same thing and
 * did not do the same thing.
 *
 * Now each control answers one question and they combine: chips for visibility
 * (three states, visible without opening anything), and two icon menus — stock
 * and order — sitting to the left of the search field, where they cost a
 * gesture to read but no width to display.
 */
const VISIBILITY = [
  { value: "", label: "Бүгд" },
  { value: "active", label: "Идэвхтэй" },
  { value: "hidden", label: "Нуусан" },
];

/** The first entry of each list is the default — picking it clears the param. */
const STOCK = [
  { value: "", label: "Бүх үлдэгдэл" },
  { value: "ok", label: "Хэвийн" },
  { value: "low", label: "Бага" },
  { value: "soldout", label: "Дууссан" },
];

const SORT = [
  { value: "", label: "Нэрээр" },
  { value: "brand", label: "Брэндээр" },
  { value: "price-asc", label: "Үнэ өсөхөөр" },
  { value: "price-desc", label: "Үнэ буурахаар" },
  { value: "stock", label: "Үлдэгдэл багаас" },
];

/**
 * One filter as an icon button. Collapsing the two dropdowns to icons is what
 * lets them sit beside the search field instead of below it — but an icon on
 * its own cannot say what it is currently set to, so it carries the chosen
 * label in its `title`, lights up in the chip's active colour whenever the
 * value is not the default, and marks the live row inside the menu.
 */
function IconFilter({
  icon: Icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: typeof Boxes;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const isDefault = current.value === "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current.label}`}
          title={`${label}: ${current.label}`}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full transition-colors md:size-9",
            isDefault
              ? "bg-secondary text-muted-foreground hover:text-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value || "default"}
            onSelect={() => onSelect(o.value)}
            className={cn(
              "min-h-11 md:min-h-0",
              o.value !== current.value && "text-muted-foreground",
            )}
          >
            {/* A dot, not a tick: `DropdownMenuItem` greys every `svg` it
                contains, so a check icon would read as unselected. */}
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                o.value === current.value ? "bg-gold-strong" : "bg-transparent",
              )}
            />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProductsToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  // Every filter change re-runs the server component. Inside a transition the
  // current rows stay on screen and the route's `loading.tsx` never takes over,
  // so typing doesn't blank the list a character at a time.
  const [pending, startTransition] = React.useTransition();

  const patch = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // The old single-parameter form; carrying it forward would re-apply a
      // filter the operator just cleared.
      next.delete("status");
      startTransition(() => {
        router.replace(`/admin/products?${next.toString()}`);
      });
    },
    [params, router],
  );

  // Debounced live search, same feel as the storefront.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) patch("q", q.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, patch]);

  const vis = params.get("vis") ?? "";

  return (
    <div
      // Dim rather than block: the list under it is still the previous result,
      // and taking the controls away mid-type is worse than a stale row.
      //
      // Two layouts, not one wrapping row. Four controls with fixed widths in a
      // `flex-wrap` broke onto a phone wherever they happened to run out of
      // room — a half-width search box, then two chips and a dropdown crammed
      // together, then the last dropdown alone. On a phone each control gets a
      // full-width band of its own; from `md` the whole thing collapses back
      // into the single inline row a wide screen has space for.
      className={cn(
        "space-y-2 transition-opacity md:flex md:flex-wrap md:items-center md:gap-x-3 md:gap-y-2 md:space-y-0",
        pending && "opacity-60",
      )}
      aria-busy={pending}
    >
      {/* The two dropdowns ride to the left of the search field as icons, so
          the row costs one band on a phone instead of three. */}
      <div className="flex items-center gap-2">
        <IconFilter
          icon={Boxes}
          label="Үлдэгдэл"
          options={STOCK}
          value={params.get("stock") ?? ""}
          onSelect={(v) => patch("stock", v)}
        />
        <IconFilter
          icon={ArrowUpDown}
          label="Эрэмбэ"
          options={SORT}
          value={params.get("sort") ?? ""}
          onSelect={(v) => patch("sort", v)}
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          aria-label="Нэр, брэндээр хайх"
          placeholder="Нэр, брэндээр хайх…"
          className="h-11 min-w-0 flex-1 md:h-9 md:w-56 md:flex-none"
        />
      </div>

      <div
        role="group"
        aria-label="Харагдацаар шүүх"
        // Three equal parts on a phone: the chips are one choice, so they read
        // as one control rather than three words of different lengths.
        className="grid grid-cols-3 gap-1.5 md:flex md:items-center"
      >
        {VISIBILITY.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={vis === v.value}
            onClick={() => patch("vis", v.value)}
            className={cn(
              // Every chip carries a surface: the borderless system leaves an
              // unfilled chip as a bare floating word.
              "min-h-11 rounded-full px-3.5 text-xs font-medium transition-colors md:min-h-9",
              vis === v.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

    </div>
  );
}
