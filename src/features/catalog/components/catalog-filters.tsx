"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";
import { useFilterQuery } from "./use-filter-query";
import type { ScentFamilyOption } from "@/lib/types";
import type { BrandLogos } from "@/features/products/components/brand-marquee";

const PRICE_STEP = 1000;

const TAGS: { value: string; label: string }[] = [
  { value: "new", label: "Шинэ" },
  { value: "hot", label: "Эрэлттэй" },
  { value: "sale", label: "Хямдрал" },
];

const SEASONS_F: { value: string; label: string }[] = [
  { value: "spring", label: "Хавар" },
  { value: "summer", label: "Зун" },
  { value: "autumn", label: "Намар" },
  { value: "winter", label: "Өвөл" },
];

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
  children,
}: {
  active: boolean;
  onClick: () => void;
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
}) {
  const { values, toggle, setMany, clearAll, activeCount, searchParams } =
    useFilterQuery();

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
      <div className="flex items-center justify-between">
        <h2 className="h-9 font-serif text-lg font-semibold">Шүүлтүүр</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Цэвэрлэх ({activeCount})
          </Button>
        )}
      </div>

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
          {SEASONS_F.map((s) => (
            <Chip
              key={s.value}
              active={values("season").includes(s.value)}
              onClick={() => toggle("season", s.value)}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </Group>
      <Separator />

      <Group title="Таг">
        <div className="grid grid-cols-3 gap-2">
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
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-2">
          {brands.map((b) => {
            const logo = brandLogos[b];
            return (
              <Chip
                key={b}
                active={values("brand").includes(b)}
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
                      // The list is a short scroll box, so a lazy logo blinks
                      // in under the cursor as the shopper scrolls the brands.
                      loading="eager"
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
      </Group>
    </div>
  );
}
