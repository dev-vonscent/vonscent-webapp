"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { GENDERS, GENDER_LABEL, SEASON_LABEL, SEASONS } from "@/lib/constants";
import { useFilterQuery } from "./use-filter-query";
import type { ScentFamilyOption } from "@/lib/types";
import type { BrandLogos } from "@/features/products/components/brand-marquee";

const PRICE_STEP = 1000;

/**
 * Хураасан үед харагдах брэндийн тоо (2 баганаар 5 мөр). Жагсаалт өөрөө
 * гүйлгэгддэг хайрцаг байхаа больсон: sidebar болон гар утасны sheet аль
 * аль нь гүйлгэгддэг тул дотор нь дахин scroll хийвэл хоёр scroll давхарлаж,
 * хулгана аль нэгэнд нь «гацдаг» байв.
 */
const BRANDS_COLLAPSED = 10;

const TAGS: { value: string; label: string }[] = [
  { value: "new", label: "Шинэ" },
  { value: "hot", label: "Эрэлттэй" },
  { value: "sale", label: "Хямдрал" },
];

/** «Бүх улирал» тусдаа явна — доорх дөрөв нь дан улирлын сонголт. */
const SINGLE_SEASONS = SEASONS.filter((s) => s !== "all");

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/** Selectable filter chip — dark gray when off, light gray when selected. */
function Chip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "truncate rounded-sm px-3 py-2 text-center text-sm font-medium transition-colors",
        active
          ? "bg-muted-foreground text-background"
          : "bg-secondary text-foreground hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function CatalogFilters({
  brands,
  brandLogos,
  priceBounds,
  families,
  showClear = true,
}: {
  brands: string[];
  /**
   * Brand name → logo path, from the `brands` table. Passed in rather than
   * looked up here: this is a client component, and the list used to be a
   * hard-coded seven-entry map that silently went stale every time the shop
   * took on a new house.
   */
  brandLogos: BrandLogos;
  priceBounds: { min: number; max: number };
  /** Live taxonomy from `scent_families` — the admin owns this list. */
  families: ScentFamilyOption[];
  /** The mobile sheet puts «Цэвэрлэх» in its title row instead. */
  showClear?: boolean;
}) {
  const {
    values,
    toggle,
    setSingle,
    setMany,
    clearAll,
    activeCount,
    searchParams,
  } = useFilterQuery();

  // «Бүх улирал» нь бүх улирлыг дааж байгаа үнэрүүд (seasons ⊇ 'all') гэсэн
  // өөрийн гэсэн сонголт — тиймээс дан улирлуудтай хамт сонгогдохгүй: аль нэгийг
  // сонгоход нөгөө нь идэвхгүй болно.
  const season = values("season");
  const allSeasons = season.includes("all");

  function toggleAllSeasons() {
    setSingle("season", allSeasons ? undefined : "all");
  }

  function toggleSeason(value: string) {
    const picked = season.filter((s) => s !== "all");
    const next = picked.includes(value)
      ? picked.filter((s) => s !== value)
      : [...picked, value];
    setSingle("season", next.length ? next.join(",") : undefined);
  }

  const featured = searchParams.get("featured") === "1";

  // Хураасан үед ч сонгосон брэнд харагдсаар байна — эс тэгвээс идэвхтэй
  // шүүлтүүр нүднээс далд болж, яаж арилгахаа олохгүй.
  const [showAllBrands, setShowAllBrands] = React.useState(false);
  const pickedBrands = values("brand");
  const collapsedBrands = brands.filter(
    (b, i) => i < BRANDS_COLLAPSED || pickedBrands.includes(b),
  );
  const visibleBrands = showAllBrands ? brands : collapsedBrands;
  const hiddenBrandCount = brands.length - collapsedBrands.length;

  // Round bounds out to nice slider stops.
  const domainMin = Math.floor(priceBounds.min / PRICE_STEP) * PRICE_STEP;
  const domainMax = Math.ceil(priceBounds.max / PRICE_STEP) * PRICE_STEP;
  const hasPriceRange = domainMax > domainMin;

  const urlMin = Number(searchParams.get("minPrice")) || domainMin;
  const urlMax = Number(searchParams.get("maxPrice")) || domainMax;
  const [range, setRange] = React.useState<[number, number]>([urlMin, urlMax]);

  // Sync the slider when the URL changes (e.g. clearing filters or browser nav).
  React.useEffect(() => setRange([urlMin, urlMax]), [urlMin, urlMax]);

  function commitRange([lo, hi]: number[]) {
    setMany({
      minPrice: lo <= domainMin ? undefined : String(lo),
      maxPrice: hi >= domainMax ? undefined : String(hi),
    });
  }

  return (
    <div className="space-y-4">
      {/*
        No «Шүүлтүүр» heading: the chips say what this is, and on desktop the
        heading only pushed the filters down. The mobile sheet titles itself
        (and carries its own clear button next to the close button).
      */}
      {showClear && activeCount > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Цэвэрлэх ({activeCount})
          </Button>
        </div>
      )}

      <Group title="Хүйс">
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map((g) => (
            <Chip
              key={g}
              active={values("gender").includes(g)}
              onClick={() => toggle("gender", g)}
            >
              {GENDER_LABEL[g]}
            </Chip>
          ))}
        </div>
      </Group>
      <Separator />

      <Group title="Үнэрийн төрөл">
        <div className="grid grid-cols-2 gap-2">
          {families.map((f) => (
            <Chip
              key={f.slug}
              active={values("family").includes(f.slug)}
              onClick={() => toggle("family", f.slug)}
            >
              <span className="flex items-center justify-center gap-1.5">
                {/* Admin-added families may have no icon yet. */}
                {f.iconUrl && (
                  <Image
                    src={f.iconUrl}
                    alt=""
                    width={18}
                    height={18}
                    unoptimized
                    className="size-4.5 shrink-0 object-contain"
                  />
                )}
                {f.label}
              </span>
            </Chip>
          ))}
        </div>
      </Group>
      <Separator />

      <Group title="Улирал">
        <div className="grid grid-cols-2 gap-2">
          <Chip
            active={allSeasons}
            onClick={toggleAllSeasons}
            className="col-span-2"
          >
            {SEASON_LABEL.all}
          </Chip>
          {SINGLE_SEASONS.map((s) => (
            <Chip
              key={s}
              active={!allSeasons && season.includes(s)}
              onClick={() => toggleSeason(s)}
            >
              {SEASON_LABEL[s]}
            </Chip>
          ))}
        </div>
      </Group>
      <Separator />

      <Group title="Таг">
        <div className="grid grid-cols-2 gap-2">
          <Chip
            active={featured}
            onClick={() => setSingle("featured", featured ? undefined : "1")}
          >
            Онцлох
          </Chip>
          {TAGS.map((t) => (
            <Chip
              key={t.value}
              active={values("tags").includes(t.value)}
              onClick={() => toggle("tags", t.value)}
            >
              {t.label}
            </Chip>
          ))}
        </div>
      </Group>
      <Separator />

      {hasPriceRange && (
        <>
          <Group title="Үнэ (₮)">
            <div className="space-y-3 pt-1">
              <Slider
                min={domainMin}
                max={domainMax}
                step={PRICE_STEP}
                value={range}
                minStepsBetweenThumbs={1}
                onValueChange={(v) => setRange([v[0], v[1]])}
                onValueCommit={commitRange}
              />
              <div className="text-muted-foreground flex items-center justify-between text-sm">
                <span>{formatPrice(range[0])}</span>
                <span>{formatPrice(range[1])}</span>
              </div>
            </div>
          </Group>
          <Separator />
        </>
      )}

      <Group title="Брэнд">
        <div id="catalog-brands" className="grid grid-cols-2 gap-2">
          {visibleBrands.map((b) => {
            const logo = brandLogos[b];
            return (
              <Chip
                key={b}
                active={pickedBrands.includes(b)}
                onClick={() => toggle("brand", b)}
              >
                {logo ? (
                  <span className="flex h-6 items-center justify-center">
                    <Image
                      src={logo}
                      alt={b}
                      width={120}
                      height={24}
                      unoptimized
                      className="brand-logo h-5 w-auto object-contain"
                    />
                  </span>
                ) : (
                  b
                )}
              </Chip>
            );
          })}
        </div>
        {hiddenBrandCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllBrands((v) => !v)}
            aria-expanded={showAllBrands}
            aria-controls="catalog-brands"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors"
          >
            {showAllBrands
              ? "Хураах"
              : `Бүх брэнд харах (+${hiddenBrandCount})`}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 transition-transform",
                showAllBrands && "rotate-180",
              )}
            />
          </button>
        )}
      </Group>
    </div>
  );
}
