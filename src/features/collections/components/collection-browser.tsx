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
 * Хэдэн багцаас хойш хайлтын талбар гарах вэ.
 *
 * Нэр нь бүгд нэг дэлгэцэнд харагдаж байхад хайлт нь хэрэгсэл биш, чимэг:
 * хүн уншаад олчихно. Хайлт нь toolbar-ын өргөний тал хувийг эзэлдэг байсан
 * тул түүнийг хасахад хүйс, эрэмбэ хоёр нэг мөрөнд амархан багтдаг.
 */
const SEARCH_MIN_COLLECTIONS = 7;

/**
 * Үүнээс цөөн багцтай үед шүүлтүүрийн мөр огт гарахгүй — 1-2 багцыг хайж,
 * шүүж, эрэмбэлэх гэж дөрвөн хэрэгсэл өгөх нь хуудсыг хоосон, ажилгүй
 * харагдуулдаг. Ийм үед URL-ын шүүлтийг ч хэрэглэхгүй: хэрэглэгч засах
 * аргагүй шүүлт нь зүгээр л алга болсон багц болж харагдана.
 */
const CONTROLS_MIN_COLLECTIONS = 3;

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

/**
 * Хүйсний шүүлтүүр — segmented control.
 *
 * Өмнө нь дөрвөн салангид chip байсан: «нэгийг нь л сонгоно» гэдэг нь
 * хэлбэрээсээ уншигдахгүй, сонгогдсон нь бүдэг саарал (`bg-muted-foreground`)
 * тул хажуугийнхаасаа бараг ялгардаггүй байв. Нэг гадаргуу дотор хуваасан
 * хэсгүүд нь тэр хоёуланг нь шийднэ: багц нь «нэг сонголт» гэдгийг харуулж,
 * сонгогдсон нь цул өнгөөр (`bg-foreground`) тодорно — сайтын бусад
 * сонголттой (хэмжээний товч, багцын хуудас) ижил хэл.
 */
function GenderSegmented({
  value,
  onChange,
  className,
}: {
  value: GenderFilter;
  onChange: (g: GenderFilter) => void;
  className?: string;
}) {
  const opts: GenderFilter[] = ["all", ...GENDERS];
  return (
    <div
      role="radiogroup"
      aria-label="Хүйс"
      className={cn(
        "bg-secondary grid grid-cols-4 gap-1 rounded-lg p-1",
        className,
      )}
    >
      {opts.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={cn(
            "truncate rounded-md px-2.5 py-1.5 text-center text-sm font-medium transition-colors",
            value === g
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
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
  customEnabled,
}: {
  collections: Collection[];
  /** Өөрөө багц угсрах боломж нээлттэй эсэх (хоосон төлөвийн санал). */
  customEnabled: boolean;
}) {
  /*
    Шүүлт нь URL-д амьдарна. Өмнө нь зөвхөн `useState` байсан тул нэг багц
    нээгээд «буцах» дармагц шүүлт нь тэглэгддэг байв — утсан дээр тап →
    буцах нь үзэх гол хэв маяг учир шүүлт бүрийг дахин хийлгэдэг байсан.
  */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const showRail = collections.length >= RAIL_MIN_COLLECTIONS;
  const showControls = collections.length >= CONTROLS_MIN_COLLECTIONS;
  // Хайлт нь хажуугийн баганатай нэг босготой: багана гармагц хайлт нь
  // түүний дээр суудаг тул toolbar-ын өргөнийг идэхээ больдог.
  const showSearch = collections.length >= SEARCH_MIN_COLLECTIONS;

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
    // Хяналт харагдахгүй үед URL-ын шүүлт ч хэрэглэгдэхгүй — хэрэглэгчийн
    // засах аргагүй шүүлт нь зүгээр л «багц алга» болж харагдана.
    if (!showControls) {
      return [...collections].sort(
        (a, b) => Number(b.isFeatured) - Number(a.isFeatured),
      );
    }
    const priced = range[0] > domainMin || range[1] < domainMax;
    const list = collections.filter((c) => {
      if (!matchesGender(c.gender, gender)) return false;
      if (
        showSearch &&
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
  }, [
    collections,
    q,
    gender,
    sort,
    range,
    domainMin,
    domainMax,
    savedOf,
    showControls,
    showSearch,
  ]);

  const activeCount =
    (gender !== "all" ? 1 : 0) +
    (showSearch && q ? 1 : 0) +
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
        <GenderSegmented value={gender} onChange={setGender} />
      </div>
      {hasPriceRange && (
        <>
          <Separator />
          {priceFilter}
        </>
      )}
    </div>
  );

  const sortSelect = (
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
  );

  return (
    <div>
      {/*
        Нэг мөрийн toolbar — утсан дээр үргэлж, багц цөөхөн бол бүх өргөнд.
        Өмнө нь энэ нь гурван давхар (хайлт+эрэмбэ / chips / үнэ) 130px
        өндөр блок байсан бөгөөд 1400px дэлгэцийн дөрөвний нэгийг л
        ашигладаг, үлдсэнийг нь хоосон орхидог байв. Хүйс зүүн талдаа,
        эрэмбэ ба хайлт баруун талдаа бөөгнөрснөөр гурав нь нэг систем мэт
        уншигдана.
      */}
      {showControls && (
        <div
          className={cn(
            "border-border flex flex-wrap items-center gap-3 border-y py-3",
            showRail && "lg:hidden",
          )}
        >
          <h2 className="sr-only">Шүүлтүүр</h2>
          <GenderSegmented
            value={gender}
            onChange={setGender}
            className="w-full sm:w-auto"
          />
          <div className="ms-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {showSearch && (
              <SearchInput
                value={q}
                onChange={setQ}
                className="min-w-0 flex-1 sm:w-56 sm:flex-none"
              />
            )}
            {sortSelect}
          </div>
          {clearButton && <div className="ms-auto sm:ms-0">{clearButton}</div>}
          {hasPriceRange && (
            <div className="w-full pt-1 lg:max-w-xs">{priceFilter}</div>
          )}
        </div>
      )}

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
            {sortSelect}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="Тохирох багц олдсонгүй"
              description="Шүүлтүүрээ өөрчилж, дахин хайж үзээрэй."
              action={
                // Толгойн панель гүйлгээний дээр үлдсэн ч, шүүлтээрээ юу ч
                // олоогүй хүн яг энэ мөчид тэр гарцыг дахин сонсох ёстой.
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={clearAll}>Шүүлтүүр цэвэрлэх</Button>
                  {customEnabled && (
                    <Button asChild variant="secondary">
                      <Link href="/collections/build">Багц угсрах</Link>
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <CollectionGrid collections={shown} />
          )}
        </div>
      </div>
    </div>
  );
}
