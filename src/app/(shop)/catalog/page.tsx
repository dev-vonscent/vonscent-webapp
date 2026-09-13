import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getCatalog, getBrands, getPriceBounds } from "@/features/products/api";
import { getActiveBrands, getScentFamilies } from "@/features/taxonomy/api";
import { parseFilters } from "@/features/catalog/parse";
import { CatalogFilters } from "@/features/catalog/components/catalog-filters";
import { CatalogFilterSheet } from "@/features/catalog/components/catalog-filter-sheet";
import { CatalogSort } from "@/features/catalog/components/catalog-sort";
import { CatalogSearch } from "@/features/catalog/components/catalog-search";
import { CatalogPagination } from "@/features/catalog/components/catalog-pagination";
import { CatalogResults } from "@/features/catalog/components/catalog-results";
import { FilterQueryProvider } from "@/features/catalog/components/use-filter-query";
import { ProductGrid } from "@/features/products/components/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * The route itself is dynamic — it reads `searchParams`, so a filtered view is
 * rendered per request and this window only covers the unfiltered /catalog
 * entry. The filter data behind it is what's actually cached: `catalogSearch`,
 * the facets and the taxonomy (features/products/api.ts, features/taxonomy)
 * each carry their own window plus a tag that revalidatePublic() purges.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Каталог",
  description: "Бүх үнэртэн — брэнд, хүйс, үнэрийн төрлөөр шүүж сонгоорой.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const [result, brands, priceBounds, families, brandRows] = await Promise.all([
    getCatalog(filters),
    getBrands(),
    getPriceBounds(),
    getScentFamilies(),
    getActiveBrands(),
  ]);
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
            {filters.search
              ? `${result.total} илэрц олдлоо`
              : `${result.total} бараа олдлоо`}
          </p>
        </div>

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

        <div className="mt-6 flex gap-10 lg:mt-8">
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
            {/* Sort — top-right above the products (desktop) */}
            <div className="mb-4 hidden items-center justify-end lg:flex">
              <CatalogSort />
            </div>

            <CatalogResults>
              {result.items.length === 0 ? (
                <EmptyState
                  size="lg"
                  icon={SearchX}
                  title="Илэрц олдсонгүй"
                  description="Шүүлтүүрээ өөрчилж дахин оролдоно уу."
                  action={
                    <Button asChild variant="outline">
                      <Link href="/catalog">Бүх барааг үзэх</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                  <ProductGrid products={result.items} />
                  <CatalogPagination
                    page={result.page}
                    perPage={result.perPage}
                    total={result.total}
                  />
                </>
              )}
            </CatalogResults>
          </div>
        </div>
      </div>
    </FilterQueryProvider>
  );
}
