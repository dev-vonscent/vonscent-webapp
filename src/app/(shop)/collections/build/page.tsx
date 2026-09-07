import type { Metadata } from "next";
import Link from "next/link";
import {
  getBuilderProducts,
  getCollectionSettings,
} from "@/features/collections/api";
import { getBrands, getPriceBounds } from "@/features/products/api";
import { getActiveBrands } from "@/features/taxonomy/api";
import { getScentFamilies } from "@/features/taxonomy/api";
import { CollectionBuilder } from "@/features/collections/components/builder";
import { parseFilters } from "@/features/catalog/parse";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Багц угсрах",
  description: "Дуртай үнэртнүүдээ сонгож, хямдралтай өөрийн багц угсраарай.",
};

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Шүүлт, хайлт, хуудас нь URL-д — каталогийн хуудастай ижил (refresh,
  // «буцах», хуваалцсан холбоос бүгд ажиллана).
  const filters = parseFilters(await searchParams);
  const [page, settings, brands, brandRows, priceBounds, families] =
    await Promise.all([
      getBuilderProducts(filters),
      getCollectionSettings(),
      getBrands(),
      getActiveBrands(),
      getPriceBounds(),
      getScentFamilies(),
    ]);
  const brandLogos = Object.fromEntries(
    brandRows.map((b) => [b.name, b.logoUrl]),
  );

  let isLoggedIn = false;
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(user);
  }

  if (!settings.customEnabled) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Багц угсрах</h1>
        <p className="text-muted-foreground mt-2">
          Өөрийн багц угсрах боломж одоогоор идэвхгүй байна.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/collections">Бэлэн багцууд үзэх</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-352 px-4 py-6 md:px-8">
      <h1 className="mb-4 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
        Багц угсрах
      </h1>
      <CollectionBuilder
        products={page.items}
        total={page.total}
        page={page.page}
        perPage={page.perPage}
        settings={settings}
        isLoggedIn={isLoggedIn}
        brands={brands}
        brandLogos={brandLogos}
        priceBounds={priceBounds}
        families={families}
      />
    </div>
  );
}
