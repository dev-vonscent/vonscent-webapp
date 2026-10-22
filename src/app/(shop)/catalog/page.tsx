import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getCatalog, getBrands, getPriceBounds } from "@/features/products/api";
import { getActiveBrands, getScentFamilies } from "@/features/taxonomy/api";
import {
  getCatalogCollections,
  getCollectionPriceBounds,
} from "@/features/collections/api";
import { parseFilters } from "@/features/catalog/parse";
import { preferredStatuses } from "@/features/products/card-status";
import { CatalogFilters } from "@/features/catalog/components/catalog-filters";
import { CatalogFilterSheet } from "@/features/catalog/components/catalog-filter-sheet";
import { CatalogSort } from "@/features/catalog/components/catalog-sort";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { CatalogInfiniteGrid } from "@/features/catalog/components/catalog-infinite-grid";
import { CatalogResults } from "@/features/catalog/components/catalog-results";
import { FilterQueryProvider } from "@/features/catalog/components/use-filter-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CATALOG_PAGE_SIZE } from "@/lib/constants";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getShopExtras } from "@/features/extras/api";
import {
  CatalogTabShell,
  CatalogTabs,
} from "@/features/extras/components/catalog-tabs";
import { ExtrasCatalog } from "@/features/extras/components/extras-catalog";
import { EXTRA_SORT_OPTIONS } from "@/features/extras/lib/sort";

/**
 * The route itself is dynamic — it reads `searchParams`, so a filtered view is
 * rendered per request and this window only covers the unfiltered /catalog
 * entry. The filter data behind it is what's actually cached: `catalogSearch`,
 * the facets and the taxonomy (features/products/api.ts, features/taxonomy)
 * each carry their own window plus a tag that revalidatePublic() purges.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  ...pageMetadata("/catalog"),
  title: "Каталог",
  description: "Бүх үнэртэн — брэнд, хүйс, үнэрийн төрлөөр шүүж сонгоорой.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // «Нэмэлт бараа» таб (extras-shop-plan §9, туг `extras_shop`). Хаалттай үед
  // `?tab=extras` нь энгийн каталог руу унана — таб ч харагдахгүй.
  const extrasOn = await isFeatureEnabled("extras_shop");
  const q = typeof params.q === "string" ? params.q : undefined;
  if (extrasOn && params.tab === "extras") {
    const items = await getShopExtras();
    return (
      <FilterQueryProvider>
        <div className="mx-auto max-w-352 px-4 py-8 md:px-8">
          <div className="mb-6">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              Каталог
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {items.length} нэмэлт бараа
            </p>
          </div>
          <CatalogTabShell
            tabs={
              <CatalogTabs active="extras" q={q}>
                <CatalogSort options={EXTRA_SORT_OPTIONS} />
              </CatalogTabs>
            }
          >
            <ExtrasCatalog items={items} />
          </CatalogTabShell>
        </div>
      </FilterQueryProvider>
    );
  }
  const filters = parseFilters(params);
  // `page`-гүй шүүлтүүр: доош гүйлгэх жагсаалтын түлхүүр. Шүүлтүүр солигдоход
  // жагсаалт шинээр эхэлнэ.
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v === undefined) continue;
    query.set(k, Array.isArray(v) ? v.join(",") : v);
  }
  // Багцууд устай нэг дүрмээр шүүгдэж, эрэмбээрээ холилдоно
  // (`getCatalogCollections`). «Хямдрал» таг багцгүй (клиент, 2026-09-30).
  const [
    result,
    brands,
    perfumeBounds,
    families,
    brandRows,
    bundles,
    bundleBounds,
    requestsOn,
  ] = await Promise.all([
    getCatalog({ ...filters, perPage: CATALOG_PAGE_SIZE }),
    getBrands(),
    getPriceBounds(),
    getScentFamilies(),
    getActiveBrands(),
    getCatalogCollections(filters),
    getCollectionPriceBounds(),
    isFeatureEnabled("perfume_requests"),
  ]);
  // Үнийн slider ус, багц хоёуланг хамарна — эс бөгөөс багцууд (усны дээд
  // үнээс үнэтэй) slider-ийн мужаас гадна үлдэж, сонгох боломжгүй байв.
  const priceBounds = bundleBounds
    ? {
        min: perfumeBounds.min
          ? Math.min(perfumeBounds.min, bundleBounds.min)
          : bundleBounds.min,
        max: Math.max(perfumeBounds.max, bundleBounds.max),
      }
    : perfumeBounds;
  const collections = bundles.items;
  const counts = [
    filters.kind !== "bundle" && `${result.total} бараа`,
    bundles.total > 0 && `${bundles.total} багц`,
  ]
    .filter(Boolean)
    .join(", ");
  // `getBrands()` is the list that actually has products (and their order);
  // the brands table only supplies the artwork.
  const brandLogos = Object.fromEntries(
    brandRows.map((b) => [b.name, b.logoUrl]),
  );

  return (
    <FilterQueryProvider>
      <div className="mx-auto max-w-352 px-4 py-8 md:px-8">
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {filters.search ? `«${filters.search}» хайлтын үр дүн` : "Каталог"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {counts || "0 бараа"}
          </p>
        </div>

        <CatalogTabShell
          tabs={
            <CatalogTabs active={extrasOn ? "perfume" : null} q={q}>
              <CatalogSort />
            </CatalogTabs>
          }
        >
          {/* Controls — mobile only (on desktop the search sits above the sidebar) */}
          <div className="border-border flex items-center gap-2 border-y py-3 lg:hidden">
            <CatalogFilterSheet
              brands={brands}
              brandLogos={brandLogos}
              priceBounds={priceBounds}
              families={families}
            />
            <CatalogSort iconOnly />
            <CatalogSearch className="flex-1" />
          </div>

          <div className="mt-6 flex gap-10">
            {/* Desktop sidebar: search above the filter, sharing its width */}
            <aside className="hidden w-72 shrink-0 lg:block">
              <CatalogSearch className="mb-6" />
              <CatalogFilters
                brands={brands}
                brandLogos={brandLogos}
                priceBounds={priceBounds}
                families={families}
              />
            </aside>

            {/*
          `min-w-0` is load-bearing, not tidiness. A flex child defaults to
          `min-width: auto`, so the product grid pushed this column out to its
          own content width and the whole page scrolled sideways on a phone —
          93px of it, measured at 390px.
        */}
            <div className="min-w-0 flex-1">
              <CatalogResults>
                {result.items.length === 0 && collections.length === 0 ? (
                  <EmptyState
                    size="lg"
                    icon={SearchX}
                    title="Илэрц олдсонгүй"
                    description={
                      requestsOn && filters.search
                        ? "Хайж буй үнэртэн тань манайд байхгүй бол бидэнд мэдэгдээрэй. Олон хүний хүссэн үнэртнийг бид түрүүлж оруулж ирнэ."
                        : "Шүүлтүүрээ өөрчилж дахин оролдоно уу."
                    }
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {/* Хайлтаар олдоогүй үнэртнийг санал болгох (0137). */}
                        {requestsOn && filters.search && (
                          <Button asChild>
                            <Link
                              href={`/request?q=${encodeURIComponent(filters.search)}`}
                            >
                              Үнэртэн санал болгох
                            </Link>
                          </Button>
                        )}
                        <Button asChild variant="outline">
                          <Link href="/catalog">Бүх барааг үзэх</Link>
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <CatalogInfiniteGrid
                    key={query.toString()}
                    initial={result}
                    query={query.toString()}
                    collections={collections}
                    sort={filters.sort}
                    prefer={preferredStatuses(filters)}
                  />
                )}
              </CatalogResults>
            </div>
          </div>
        </CatalogTabShell>
      </div>
    </FilterQueryProvider>
  );
}
