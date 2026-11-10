import type { Metadata } from "next";
import { MarkSeen } from "@/components/shared/mark-seen";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getBottleFacets, getShopExtras } from "@/features/extras/api";
import { getActiveBrands, getScentFamilies } from "@/features/taxonomy/api";
import { BottlesCatalog } from "@/features/extras/components/bottles-catalog";
import { extraSection } from "@/features/extras/lib/sections";
import { FilterQueryProvider } from "@/features/catalog/components/use-filter-query";

/** Tab, шүүлт, эрэмбэ нь client дээр (`BottlesCatalog`) — жагсаалт л cache-тэй. */
export const revalidate = 60;

export const metadata: Metadata = {
  ...pageMetadata("/bottles"),
  title: "Үнэртний шил",
  description:
    "Бүтэн, лацтай шил, үлдэгдэлтэй эх шил, цуглуулгын хоосон шил — брэндээр нь хайж олоорой.",
};

/**
 * «Үнэртний шил» (extras-shop-plan §19.2). Өргөн, гарчиг нь `/catalog`-тай
 * ижил. Туг `extras_shop` хаалттай бол 404.
 */
export default async function BottlesPage() {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const [all, facets, families, brandRows] = await Promise.all([
    getShopExtras(),
    getBottleFacets(),
    getScentFamilies(),
    getActiveBrands(),
  ]);
  const items = all
    .filter((e) => extraSection(e) === "bottles")
    .map((e) => ({ ...e, facets: facets.get(e.id) ?? null }));
  // Каталогтой ижил брэндийн лого (бүтэн / үлдэгдэлтэй шилний шүүлтүүрт).
  const brandLogos = Object.fromEntries(
    brandRows.map((b) => [b.name, b.logoUrl]),
  );
  return (
    <FilterQueryProvider>
      <div className="mx-auto max-w-420 px-4 py-8 md:px-8">
        <h1
          data-page-title
          className="mb-6 text-3xl font-semibold tracking-tight"
        >
          Үнэртний шил
        </h1>
        <MarkSeen seenKey="bottles" />
        <BottlesCatalog
          items={items}
          families={families}
          brandLogos={brandLogos}
        />
      </div>
    </FilterQueryProvider>
  );
}
