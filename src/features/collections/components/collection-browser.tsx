"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageOpen, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
      // `repeat(4,1fr)` — багана нь бичгээсээ нарийсахгүй. `grid-cols-4`
      // (minmax(0,1fr)) үед «Эрэгтэй», «Эмэгтэй» нь «Эрэгт…» болж тасардаг байв.
      className={cn(
        "bg-secondary grid grid-cols-[repeat(4,1fr)] gap-1 rounded-lg p-1",
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
            "rounded-md px-2.5 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors",
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

  const showControls = collections.length >= CONTROLS_MIN_COLLECTIONS;
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
    const list = collections.filter((c) => {
      if (!matchesGender(c.gender, gender)) return false;
      if (
        showSearch &&
        q &&
        !`${c.name} ${c.description}`.toLowerCase().includes(q.toLowerCase())
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
  }, [collections, q, gender, sort, savedOf, showControls, showSearch]);

  const activeCount = (gender !== "all" ? 1 : 0) + (showSearch && q ? 1 : 0);

  React.useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (gender !== "all") next.set("gender", gender);
    if (sort !== "featured") next.set("sort", sort);
    const qs = next.toString();
    if (qs === params.toString()) return;
    // Бичих бүрд биш — бичиж дуусахад. Слайдер чирэхэд ч мөн адил.
    const t = setTimeout(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [q, gender, sort, params, pathname, router]);

  function clearAll() {
    setQ("");
    setGender("all");
  }

  const clearButton = activeCount > 0 && (
    <Button variant="ghost" size="sm" onClick={clearAll}>
      Цэвэрлэх ({activeCount})
    </Button>
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
        Нэг мөрийн toolbar — багцын тооноос үл хамааран үргэлж дээр.
        Өмнө нь 7+ багцтай үед десктоп дээр 320px-ийн хажуугийн багана руу
        шилждэг байв: хүйс, үнэ, эрэмбэ гэсэн гурван хяналтад дэлгэцийн
        дөрөвний нэгийг зарцуулж, «Эрэгтэй»/«Эмэгтэй» нь тэнд тасардаг байсан.
        Хүйс зүүн талдаа, хайлт ба эрэмбэ баруун талдаа. Үнийн гулсуур
        байхгүй — хэдхэн багцад «Үнэ: бага → их» эрэмбэ нь хангалттай.
      */}
      {showControls && (
        <div className="border-border flex flex-wrap items-center gap-x-6 gap-y-3 border-y py-3">
          <h2 className="sr-only">Шүүлтүүр</h2>
          <GenderSegmented
            value={gender}
            onChange={setGender}
            className="w-full sm:w-auto"
          />
          <div className="ms-auto flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {clearButton}
            {showSearch && (
              <SearchInput
                value={q}
                onChange={setQ}
                className="min-w-0 flex-1 sm:w-56 sm:flex-none"
              />
            )}
            {sortSelect}
          </div>
        </div>
      )}

      <div className="mt-6 lg:mt-8">
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
  );
}
