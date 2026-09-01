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
import { ProductGrid } from "@/features/products/components/product-grid";
import { Button } from "@/components/ui/button";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
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

        <div className="flex-1">
          {/* Sort — top-right above the products (desktop) */}
          <div className="mb-4 hidden items-center justify-end lg:flex">
            <CatalogSort />
          </div>

          {result.items.length === 0 ? (
            <div className="border-border flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-24 text-center">
              <SearchX className="text-muted-foreground size-10" />
              <div>
                <p className="font-medium">Илэрц олдсонгүй</p>
                <p className="text-muted-foreground text-sm">
                  Шүүлтүүрээ өөрчилж дахин оролдоно уу.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/catalog">Бүх барааг үзэх</Link>
              </Button>
            </div>
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
        </div>
      </div>
    </div>
  );
}
