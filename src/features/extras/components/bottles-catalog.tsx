"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { PackageSearch, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { CatalogSort } from "@/features/catalog/components/catalog-sort";
import { FilterSheet } from "@/features/catalog/components/catalog-filter-sheet";
import {
  CatalogFilters,
  Chip,
  Group,
} from "@/features/catalog/components/catalog-filters";
import { useFilterQuery } from "@/features/catalog/components/use-filter-query";
import type { BrandLogos } from "@/features/products/components/brand-marquee";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import type { ScentFamilyOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { BottleListItem } from "../api";
import { type BottleKind, bottleKind } from "../lib/bottle-kind";
import {
  BOTTLE_TABS,
  BOTTLE_TAB_LABEL,
  FACET_TABS,
  TAB_SCOPED_KEYS,
  brandCounts,
  countBottleTabs,
  filterBottles,
  parseBottleFilters,
  resolveBottleTab,
} from "../lib/sections";
import { EXTRA_SORT_OPTIONS, parseExtraSort, sortExtras } from "../lib/sort";
import { ExtraCard } from "./extra-card";
import { STICKY_GAP_COVER } from "./sticky-gap";

const SEARCH_PLACEHOLDER = "Брэнд, нэрээр хайх…";

/** Tab бүрийн нэг өгүүлбэр — гурван шилний зураг адилхан тул ялгааг үгээр. */
const TAB_INTRO: Record<BottleKind, string> = {
  sealed: "Нээгээгүй, лацтай шинэ үнэртэн.",
  leftover: "Дотроо үлдэгдэлтэй шил.",
  empty: "Цуглуулга болон чимэглэлд зориулсан хоосон шил.",
};

/** Grid эхэндээ ба доош гүйлгэх бүрд нэмэх карт (100+ зургийг нэг дор биш). */
const PAGE = 24;
/** Sidebar-д хураасан үед харагдах брэнд (2 баганаар 5 мөр). */
const BRANDS_COLLAPSED = 10;

/**
 * «Үнэртний шил» (`/bottles`, extras-shop-plan §19.2) — mobile-first:
 *
 *   [Бүтэн шил 24 | Үлдэгдэлтэй 3 | Хоосон шил 100]   ← sticky tab
 *   [Шүүлтүүр] [⇅] [хайлт……………]                    ← брэнд нь шүүлтүүрт (лого)
 *   2 баганатай grid
 *
 * Бүх шил нэг cache-тэй уншилтаар ирж client дээр шүүгдэнэ — tab, брэнд
 * шууд солигдоно. URL: `type`, `brand`, `q`, `stock`, `sort`.
 */
export function BottlesCatalog({
  items,
  families,
  brandLogos,
}: {
  items: BottleListItem[];
  families: ScentFamilyOption[];
  brandLogos: BrandLogos;
}) {
  const { searchParams, setMany } = useFilterQuery();
  const topRef = React.useRef<HTMLDivElement>(null);

  const totals = countBottleTabs(items);
  const tab = resolveBottleTab(searchParams.get("type"), totals);
  const filters = parseBottleFilters(searchParams);
  const sort = parseExtraSort(searchParams.get("sort"));

  if (!tab) {
    return (
      <EmptyState
        size="lg"
        className="mt-6"
        icon={PackageSearch}
        title="Үнэртний шил удахгүй нэмэгдэнэ"
        description="Бүтэн, үлдэгдэлтэй, хоосон шил энд гарна. Тэр хооронд декант үнэртнүүдээ сонирхоорой."
        action={
          <Button asChild variant="outline">
            <Link href="/catalog">Үнэртэн үзэх</Link>
          </Button>
        }
      />
    );
  }

  const tabs = BOTTLE_TABS.filter((t) => totals[t] > 0);
  const ofTab = (t: BottleKind) =>
    items.filter((e) => bottleKind(e.categorySlug, e.mode) === t);
  const inTab = ofTab(tab);
  // Tab-ийн тоо одоогийн брэнд/хайлтаар — «Dior-ийн хоосон шил 3» шууд
  // харагдана. Tab өөрөө 0 болсон ч алга болохгүй (шилжихэд үсэрдэггүй).
  const filteredCounts = Object.fromEntries(
    tabs.map((t) => [t, filterBottles(ofTab(t), filters).length]),
  ) as Record<BottleKind, number>;
  const shown = sortExtras(filterBottles(inTab, filters), sort);
  // Сонгосон брэнд энэ tab-д байхгүй ч chip-ээ үлдээнэ — арилгаж болдог.
  const brands = brandCounts(inTab);
  for (const b of filters.brands)
    if (!brands.some((x) => x.brand === b)) brands.push({ brand: b, count: 0 });
  const elsewhere = tabs.find((t) => t !== tab && filteredCounts[t] > 0);
  const hasFilter =
    filters.brands.length > 0 ||
    filters.genders.length > 0 ||
    filters.families.length > 0 ||
    filters.seasons.length > 0 ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.q !== "" ||
    filters.inStock;

  // Бүтэн / үлдэгдэлтэй шил дотроо үнэртэнтэй — каталогийн шүүлтүүр бүтнээр.
  const facetTab = FACET_TABS.includes(tab);
  const filtersPanel = facetTab ? (
    <FacetFilters
      items={inTab}
      brands={brands.map((b) => b.brand)}
      families={families}
      brandLogos={brandLogos}
    />
  ) : (
    <BottleFilters brands={brands} brandLogos={brandLogos} />
  );

  const selectTab = (t: BottleKind) => {
    if (t === tab) return;
    // Үнийн муж tab бүрт өөр, шинж нь хоосон шилэнд байхгүй — далд
    // шүүлтүүр шинэ tab-ийг хоосолчихгүйн тулд цэвэрлэнэ. Брэнд, хайлт үлдэнэ.
    setMany({
      type: t === tabs[0] ? undefined : t,
      ...Object.fromEntries(TAB_SCOPED_KEYS.map((k) => [k, undefined])),
    });
    // Доош гүйлгэсэн байхад tab солиход жагсаалтын эхэнд буцна.
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollBy({ top, behavior: "instant" });
  };
  const clearFilters = () =>
    setMany({
      brand: undefined,
      q: undefined,
      stock: undefined,
      ...Object.fromEntries(TAB_SCOPED_KEYS.map((k) => [k, undefined])),
    });

  return (
    <>
      <p className="text-muted-foreground -mt-4 mb-4 text-sm text-pretty">
        {TAB_INTRO[tab]}
      </p>

      <div ref={topRef} />
      {/* Утсан дээр tab sticky (100+ шил гүйлгэж байгаад шилжинэ); desktop-д
          tab зүүн, эрэмбэ баруун талд нэг мөрөнд. */}
      <div
        className={cn(
          "lg:flex lg:items-center lg:justify-between lg:gap-6",
          tabs.length > 1
            ? cn(
                "bg-background sticky top-(--header-offset) z-20 -mx-4 px-4 py-2 transition-[top] duration-300 ease-out md:mx-0 md:px-0 lg:static",
                STICKY_GAP_COVER,
                "lg:before:hidden",
              )
            : "hidden",
        )}
      >
        {tabs.length > 1 ? (
          // Купон, захиалгын хуудастай ижил segmented tab.
          <SegmentedTabs
            label="Шилний төрөл"
            tabs={tabs.map((t) => ({
              value: t,
              label: BOTTLE_TAB_LABEL[t],
              count: filteredCounts[t],
            }))}
            value={tab}
            onChange={selectTab}
            className="lg:min-w-96"
          />
        ) : (
          <span />
        )}
        <CatalogSort options={EXTRA_SORT_OPTIONS} className="hidden lg:flex" />
      </div>

      {/* Утас: шүүлтүүр, эрэмбэ, хайлт нэг мөрөнд. Брэнд нь шүүлтүүрт
          (каталогтой ижил лого) — тусдаа chip мөр давхардал байв. */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 py-2">
          <FilterSheet>
            {facetTab ? (
              <FacetFilters
                items={inTab}
                brands={brands.map((b) => b.brand)}
                families={families}
                brandLogos={brandLogos}
                showClear={false}
              />
            ) : (
              <BottleFilters
                brands={brands}
                brandLogos={brandLogos}
                showClear={false}
              />
            )}
          </FilterSheet>
          <CatalogSort iconOnly options={EXTRA_SORT_OPTIONS} />
          <CatalogSearch className="flex-1" placeholder={SEARCH_PLACEHOLDER} />
        </div>
      </div>

      <div className="mt-4 flex gap-10 lg:mt-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          {/* «Брэнд» h3-ын өмнөх түвшин (h1 → h2 → h3). */}
          <h2 className="sr-only">Шүүлтүүр</h2>
          <CatalogSearch className="mb-6" placeholder={SEARCH_PLACEHOLDER} />
          {filtersPanel}
        </aside>

        {/* `min-w-0`: catalog/page.tsx-ийн тайлбарыг үз. */}
        <div className="min-w-0 flex-1">
          {shown.length === 0 ? (
            <EmptyState
              size="lg"
              icon={SearchX}
              title="Энэ шүүлтээр шил олдсонгүй"
              description={
                hasFilter
                  ? "Брэнд эсвэл хайлтаа өөрчилж үзээрэй."
                  : "Удахгүй шинэ шил нэмэгдэнэ."
              }
              action={
                hasFilter ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {/* Ижил шүүлтээр өөр төрөлд байвал шууд тийш. */}
                    {elsewhere && (
                      <Button onClick={() => selectTab(elsewhere)}>
                        {BOTTLE_TAB_LABEL[elsewhere]} харах (
                        {filteredCounts[elsewhere]})
                      </Button>
                    )}
                    <Button variant="outline" onClick={clearFilters}>
                      Шүүлтүүр цэвэрлэх
                    </Button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <ProgressiveGrid
              // Шүүлт солигдоход эхний 24-өөс дахин эхэлнэ.
              key={`${tab}|${searchParams.toString()}`}
              items={shown}
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Бүтэн / үлдэгдэлтэй шил — каталогийн шүүлтүүр (хүйс, үнэрийн төрөл,
 * улирал, үнэ, брэнд) ижил URL түлхүүрээр, дээр нь «Зөвхөн байгаа бараа».
 * Үнэрийн төрөл нь энэ tab-ийн шилэнд байгаа л — хоосон илэрц рүү хөтлөхгүй.
 */
function FacetFilters({
  items,
  brands,
  families,
  brandLogos,
  showClear = true,
}: {
  items: BottleListItem[];
  brands: string[];
  families: ScentFamilyOption[];
  brandLogos: BrandLogos;
  showClear?: boolean;
}) {
  const present = new Set(items.flatMap((e) => e.facets?.families ?? []));
  const prices = items.map((e) => e.fromPrice);
  return (
    <div className="space-y-4">
      <CatalogFilters
        brands={brands}
        brandLogos={brandLogos}
        families={families.filter((f) => present.has(f.slug))}
        priceBounds={{
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        }}
        showKind={false}
        showTags={false}
        showClear={showClear}
      />
      <Separator />
      <InStockToggle />
    </div>
  );
}

function InStockToggle() {
  const { searchParams, setSingle } = useFilterQuery();
  const inStock = searchParams.get("stock") === "1";
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Checkbox
        id="bottles-in-stock"
        checked={inStock}
        onCheckedChange={(v) => setSingle("stock", v ? "1" : undefined)}
      />
      <Label htmlFor="bottles-in-stock" className="text-sm font-medium">
        Зөвхөн байгаа бараа
      </Label>
    </div>
  );
}

function BottleFilters({
  brands,
  brandLogos,
  showClear = true,
}: {
  brands: { brand: string; count: number }[];
  /** Каталогийн «Брэнд»-тэй ижил лого; логогүй брэнд нэрээрээ. */
  brandLogos: BrandLogos;
  /** Утасны sheet «Цэвэрлэх»-ийг гарчгийн мөрөндөө харуулна. */
  showClear?: boolean;
}) {
  const { values, toggle, setMany, searchParams } = useFilterQuery();
  const [expanded, setExpanded] = React.useState(false);
  const picked = values("brand");
  const inStock = searchParams.get("stock") === "1";
  const active =
    picked.length + (inStock ? 1 : 0) + (searchParams.get("q") ? 1 : 0);
  const visible = expanded ? brands : brands.slice(0, BRANDS_COLLAPSED);

  return (
    <div className="space-y-4">
      {showClear && active > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMany({ brand: undefined, q: undefined, stock: undefined })
            }
          >
            Цэвэрлэх ({active})
          </Button>
        </div>
      )}
      {brands.length > 0 && (
        <Group title="Брэнд">
          <div className="grid grid-cols-2 gap-2">
            {visible.map((b) => (
              <Chip
                key={b.brand}
                active={picked.includes(b.brand)}
                onClick={() => toggle("brand", b.brand)}
              >
                {brandLogos[b.brand] ? (
                  <span className="flex h-6 items-center justify-center">
                    <Image
                      src={brandLogos[b.brand]!}
                      alt={b.brand}
                      width={120}
                      height={24}
                      unoptimized
                      draggable={false}
                      className="brand-logo h-5 w-auto object-contain"
                    />
                  </span>
                ) : (
                  b.brand
                )}
              </Chip>
            ))}
          </div>
          {brands.length > BRANDS_COLLAPSED && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Хураах" : `Бүх брэнд (${brands.length})`}
            </Button>
          )}
        </Group>
      )}
      <Separator />
      <InStockToggle />
    </div>
  );
}

/**
 * Эхний 24 картыг зурж, доош ойртоход (600px өмнө) дараагийн 24-ийг нэмнэ.
 * Бүх өгөгдөл аль хэдийн client дээр — сүлжээ хүлээхгүй, зөвхөн DOM/зураг
 * хэмнэнэ. Observer ажиллахгүй орчинд «Цааш үзэх» товч үлдэнэ.
 */
function ProgressiveGrid({ items }: { items: BottleListItem[] }) {
  const [limit, setLimit] = React.useState(PAGE);
  const sentinel = React.useRef<HTMLDivElement>(null);
  const more = items.length > limit;

  React.useEffect(() => {
    const el = sentinel.current;
    if (!more || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);

  return (
    <>
      {/* ProductGrid-тэй ижил багана — карт үнэртнийхтэй нэг хэмжээтэй. */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {items.slice(0, limit).map((e) => (
          <li key={e.id}>
            <ExtraCard
              extra={e}
              href={`/extras/${e.slug}`}
              quickAdd
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 280px"
            />
          </li>
        ))}
      </ul>
      {more && (
        <div ref={sentinel} className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
            Цааш үзэх ({items.length - limit})
          </Button>
        </div>
      )}
    </>
  );
}
