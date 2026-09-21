"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageOpen, Search, X } from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { CollectionGrid } from "./collection-grid";
import type { Collection } from "../types";
import type { Gender } from "@/db/types";

type GenderFilter = "all" | Gender;
type Sort = "featured" | "price_asc" | "price_desc" | "saved";

const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Онцлох эхэндээ" },
  { value: "price_asc", label: "Үнэ: бага → их" },
  { value: "price_desc", label: "Үнэ: их → бага" },
  { value: "saved", label: "Хэмнэлт: их → бага" },
];

const PRICE_STEP = 1000;

/**
 * Хэдэн багц байхаас хойш хажуугийн шүүлтүүрийн багана гарах вэ.
 *
 * Багц нь каталогаас ялгаатай нь цөөхөн байдаг: 3 баганын хоёр мөр (6 багц)
 * хүртэл 320px-ийн багана нь шүүх зүйлээсээ өөрөө том харагдана. Түүнээс
 * доош бол утсан дээрхтэй ижил дээд мөрийг бүх өргөнд хэрэглэнэ.
 */
const RAIL_MIN_COLLECTIONS = 7;

/**
 * «Эрэгтэй»/«Эмэгтэй» багцад unisex багц ч багтана — каталогийн
 * `expandGenders`-тэй нэг логик. «Unisex»-ийг дангаар нь сонговол зөвхөн
 * unisex: тэр нь зориуд нарийсгасан асуулт.
 */
export function matchesGender(
  collectionGender: Gender,
  filter: GenderFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "unisex") return collectionGender === "unisex";
  return collectionGender === filter || collectionGender === "unisex";
}

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
          // Дүрс нь 16px хэвээр, харин хүрэх талбай нь бүтэн 44px.
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center"
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
    // Утсан дээр 2 багана — хүрэхэд өргөн. Өргөн дэлгэц дээр агуулгынхаа
    // хэмжээгээр: 1400px өргөн «Бүгд» товч нь шүүлтүүр биш, хана болдог.
    <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap">
      {opts.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          className={cn(
            "min-h-11 truncate rounded-sm px-3 py-2 text-center text-sm font-medium transition-colors lg:min-h-0",
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
  giftPoolEnabled = false,
  trailing,
}: {
  collections: Collection[];
  giftPoolEnabled?: boolean;
  /** Grid-ийн сүүлчийн нүд — «Өөрөө угсрах» карт. */
  trailing?: React.ReactNode;
}) {
  /*
    Шүүлт нь URL-д амьдарна. Өмнө нь зөвхөн `useState` байсан тул нэг багц
    нээгээд «буцах» дармагц шүүлт нь тэглэгддэг байв — утсан дээр тап →
    буцах нь үзэх гол хэв маяг учир шүүлт бүрийг дахин хийлгэдэг байсан.
  */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = React.useState(() => params.get("q") ?? "");
  const [gender, setGender] = React.useState<GenderFilter>(() => {
    const g = params.get("gender");
    return GENDERS.includes(g as Gender) ? (g as Gender) : "all";
  });
  const [sort, setSort] = React.useState<Sort>(() => {
    const v = params.get("sort");
    return SORTS.some((o) => o.value === v) ? (v as Sort) : "featured";
  });

  const prices = collections.map((c) => c.startingPrice).filter((n) => n > 0);
  const domainMin = prices.length
    ? Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP
    : 0;
  const domainMax = prices.length
    ? Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP
    : 0;
  // Нэг багцтай үед ч floor/ceil нь 1000₮-ийн зөрүү үлдээдэг тул «domainMax >
  // domainMin» гэдэг нь юу ч шүүж чадахгүй гулсуур гаргаж ирдэг байсан.
  const hasPriceRange =
    new Set(prices).size > 1 && domainMax - domainMin >= PRICE_STEP * 2;
  const [range, setRange] = React.useState<[number, number]>(() => {
    const num = (key: string, fallback: number) => {
      const n = Number(params.get(key));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    return [
      Math.max(domainMin, num("min", domainMin)),
      Math.min(domainMax, num("max", domainMax)),
    ];
  });
  // Анхны render дээр URL-ын утгыг дарж болохгүй — зөвхөн домэйн үнэхээр
  // өөрчлөгдвөл тэглэнэ.
  const domainSettled = React.useRef(true);
  React.useEffect(() => {
    if (domainSettled.current) {
      domainSettled.current = false;
      return;
    }
    setRange([domainMin, domainMax]);
  }, [domainMin, domainMax]);

  const savedOf = React.useCallback((c: Collection) => {
    const row = c.prices.find((p) => p.ml === c.availableMls[0]);
    return row?.saved ?? 0;
  }, []);

  const shown = React.useMemo(() => {
    const priced = range[0] > domainMin || range[1] < domainMax;
    const list = collections.filter((c) => {
      if (!matchesGender(c.gender, gender)) return false;
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

  React.useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (gender !== "all") next.set("gender", gender);
    if (sort !== "featured") next.set("sort", sort);
    if (range[0] > domainMin) next.set("min", String(range[0]));
    if (range[1] < domainMax) next.set("max", String(range[1]));
    const qs = next.toString();
    if (qs === params.toString()) return;
    // Бичих бүрд биш — бичиж дуусахад. Слайдер чирэхэд ч мөн адил.
    const t = setTimeout(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [q, gender, sort, range, domainMin, domainMax, params, pathname, router]);

  function clearAll() {
    setQ("");
    setGender("all");
    setRange([domainMin, domainMax]);
  }

  const clearButton = activeCount > 0 && (
    <Button variant="ghost" size="sm" onClick={clearAll}>
      Цэвэрлэх ({activeCount})
    </Button>
  );

  const priceFilter = (
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
  );

  const Filters = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="h-9 font-serif text-lg font-semibold">Шүүлтүүр</h2>
        {clearButton}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Хүйс</h3>
        <GenderChips value={gender} onChange={setGender} />
      </div>
      {hasPriceRange && (
        <>
          <Separator />
          {priceFilter}
        </>
      )}
    </div>
  );

  const showRail = collections.length >= RAIL_MIN_COLLECTIONS;

  return (
    <div>
      {/* Compact controls — утсан дээр үргэлж, багц цөөхөн бол бүх өргөнд */}
      <div
        className={cn(
          "border-border flex flex-col gap-3 border-y py-3",
          showRail && "lg:hidden",
        )}
      >
        <div className="flex items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            className="flex-1 lg:max-w-xs"
          />
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-auto shrink-0 lg:ms-auto">
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
        <h2 className="sr-only">Шүүлтүүр</h2>
        <div className="flex flex-wrap items-center gap-2">
          <GenderChips value={gender} onChange={setGender} />
          {clearButton && <div className="ms-auto">{clearButton}</div>}
        </div>
        {hasPriceRange && <div className="pt-1 lg:max-w-xs">{priceFilter}</div>}
      </div>

      <div className="mt-6 flex gap-10 lg:mt-8">
        {/* Desktop sidebar */}
        <aside className={cn("hidden w-80 shrink-0", showRail && "lg:block")}>
          <SearchInput value={q} onChange={setQ} className="mb-6" />
          {Filters}
        </aside>

        <div className="flex-1">
          <div
            className={cn(
              "mb-4 hidden items-center justify-end",
              showRail && "lg:flex",
            )}
          >
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
            <EmptyState
              icon={PackageOpen}
              title="Тохирох багц олдсонгүй"
              description="Шүүлтүүрээ өөрчилж, дахин хайж үзээрэй."
              action={
                // Grid байхгүй болохоор «Өөрөө угсрах» нүд ч алга болно —
                // энэ хүн яг тэр саналыг сонсох ёстой хүн.
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={clearAll}>Шүүлтүүр цэвэрлэх</Button>
                  {trailing && (
                    <Button asChild variant="secondary">
                      <Link href="/collections/build">Багц угсрах</Link>
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <CollectionGrid
              collections={shown}
              giftPoolEnabled={giftPoolEnabled}
              trailing={trailing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
