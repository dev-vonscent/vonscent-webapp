"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";
import { CollectionGrid } from "./collection-grid";
import type { Collection } from "../types";
import type { Gender } from "@/db/types";

type GenderFilter = "all" | Gender;
type Sort = "featured" | "price_asc" | "price_desc" | "saved";

const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Онцлох эхэндээ" },
  { value: "price_asc", label: "Үнэ: бага → их" },
  { value: "price_desc", label: "Үнэ: их → бага" },
  { value: "saved", label: "Хэмнэлт ихтэй" },
];

const PRICE_STEP = 1000;

function SearchInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Багц хайх…"
        aria-label="Хайх"
        className="px-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Цэвэрлэх"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function GenderChips({
  value,
  onChange,
}: {
  value: GenderFilter;
  onChange: (g: GenderFilter) => void;
}) {
  const opts: GenderFilter[] = ["all", ...GENDERS];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          className={cn(
            "truncate rounded-sm px-3 py-2 text-center text-sm font-medium transition-colors",
            value === g
              ? "bg-muted-foreground text-background"
              : "bg-secondary text-foreground hover:bg-accent",
          )}
        >
          {g === "all" ? "Бүгд" : GENDER_LABEL[g]}
        </button>
      ))}
    </div>
  );
}

export function CollectionBrowser({
  collections,
}: {
  collections: Collection[];
}) {
  const [q, setQ] = React.useState("");
  const [gender, setGender] = React.useState<GenderFilter>("all");
  const [sort, setSort] = React.useState<Sort>("featured");

  const prices = collections.map((c) => c.startingPrice).filter((n) => n > 0);
  const domainMin = prices.length
    ? Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP
    : 0;
  const domainMax = prices.length
    ? Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP
    : 0;
  const hasPriceRange = domainMax > domainMin;
  const [range, setRange] = React.useState<[number, number]>([
    domainMin,
    domainMax,
  ]);
  React.useEffect(
    () => setRange([domainMin, domainMax]),
    [domainMin, domainMax],
  );

  const savedOf = React.useCallback((c: Collection) => {
    const row = c.prices.find((p) => p.ml === c.availableMls[0]);
    return row?.saved ?? 0;
  }, []);

  const shown = React.useMemo(() => {
    const priced = range[0] > domainMin || range[1] < domainMax;
    const list = collections.filter((c) => {
      if (gender !== "all" && c.gender !== gender) return false;
      if (
        q &&
        !`${c.name} ${c.description}`.toLowerCase().includes(q.toLowerCase())
      )
        return false;
      if (
        priced &&
        c.startingPrice > 0 &&
        (c.startingPrice < range[0] || c.startingPrice > range[1])
      )
        return false;
      return true;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.startingPrice - b.startingPrice;
        case "price_desc":
          return b.startingPrice - a.startingPrice;
        case "saved":
          return savedOf(b) - savedOf(a);
        default:
          return Number(b.isFeatured) - Number(a.isFeatured);
      }
    });
  }, [collections, q, gender, sort, range, domainMin, domainMax, savedOf]);

  const activeCount =
    (gender !== "all" ? 1 : 0) +
    (q ? 1 : 0) +
    (range[0] > domainMin || range[1] < domainMax ? 1 : 0);

  function clearAll() {
    setQ("");
    setGender("all");
    setRange([domainMin, domainMax]);
  }

  const Filters = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="h-9 font-serif text-lg font-semibold">Шүүлтүүр</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Цэвэрлэх ({activeCount})
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Хүйс</h3>
        <GenderChips value={gender} onChange={setGender} />
      </div>
      {hasPriceRange && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Үнэ (₮)</h3>
            <Slider
              min={domainMin}
              max={domainMax}
              step={PRICE_STEP}
              value={range}
              minStepsBetweenThumbs={1}
              onValueChange={(v) => setRange([v[0], v[1]])}
            />
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>{formatPrice(range[0])}</span>
              <span>{formatPrice(range[1])}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      {/* Mobile controls */}
      <div className="border-border flex flex-col gap-3 border-y py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} className="flex-1" />
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-auto shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <GenderChips value={gender} onChange={setGender} />
      </div>

      <div className="mt-6 flex gap-10 lg:mt-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <SearchInput value={q} onChange={setQ} className="mb-6" />
          {Filters}
        </aside>

        <div className="flex-1">
          <div className="mb-4 hidden items-center justify-end lg:flex">
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {shown.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Тохирох багц олдсонгүй.
            </p>
          ) : (
            <CollectionGrid collections={shown} />
          )}
        </div>
      </div>
    </div>
  );
}
