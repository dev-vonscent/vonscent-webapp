import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  ...pageMetadata("/collections/build", { title: "Багц үүсгэх" }),
  description: "Дуртай үнэртнүүдээ сонгож, хямдралтай өөрийн багц үүсгээрэй.",
};

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Шүүлт, хайлт, хуудас нь URL-д — каталогийн хуудастай ижил (refresh,
  // «буцах», хуваалцсан холбоос бүгд ажиллана).
  const params = await searchParams;
  // Хямдралаар шүүх/эрэмбэлэх энд байхгүй (угсарсан багц үндсэн үнээр, 8.2):
  // хуучин `?tags=sale` / `?event=` / `?sort=discount` холбоосыг анхдагч руу.
  const cleaned = withoutSaleParams(params);
  if (cleaned != null) {
    redirect(cleaned ? `/collections/build?${cleaned}` : "/collections/build");
  }
  const filters = parseFilters(params);
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
        <h1 className="font-serif text-2xl font-semibold">Багц үүсгэх</h1>
        <p className="text-muted-foreground mt-2">
          Өөрийн багц үүсгэх боломж одоогоор идэвхгүй байна.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/collections">Бэлэн багцууд үзэх</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-352 px-4 py-6 md:px-8">
      <h1
        data-page-title
        className="mb-4 font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Багц үүсгэх
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

/**
 * Хямдралын параметргүй query string; хасах зүйлгүй бол null.
 */
function withoutSaleParams(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const out = new URLSearchParams();
  let changed = false;
  for (const [k, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const v = Array.isArray(raw) ? raw.join(",") : raw;
    if (k === "event" || (k === "sort" && v === "discount")) {
      changed = true;
      continue;
    }
    if (k === "tags") {
      const tags = v.split(",").filter((t) => t && t !== "sale");
      if (tags.length !== v.split(",").filter(Boolean).length) changed = true;
      if (tags.length) out.set(k, tags.join(","));
      continue;
    }
    out.set(k, v);
  }
  return changed ? out.toString() : null;
}
