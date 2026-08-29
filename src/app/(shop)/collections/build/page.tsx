import type { Metadata } from "next";
import Link from "next/link";
import {
  getBuilderProducts,
  getCollectionSettings,
} from "@/features/collections/api";
import { getBrands, getPriceBounds } from "@/features/products/api";
import { getScentFamilies } from "@/features/taxonomy/api";
import { CollectionBuilder } from "@/features/collections/components/builder";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Багц угсрах",
  description: "Дуртай үнэртнүүдээ сонгож, хямдралтай өөрийн багц угсраарай.",
};

export default async function BuildPage() {
  const [products, settings, brands, priceBounds, families] = await Promise.all(
    [
      getBuilderProducts(),
      getCollectionSettings(),
      getBrands(),
      getPriceBounds(),
      getScentFamilies(),
    ],
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
      <h1 className="font-serif mb-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Багц угсрах
      </h1>
      <CollectionBuilder
        products={products}
        settings={settings}
        isLoggedIn={isLoggedIn}
        brands={brands}
        priceBounds={priceBounds}
        families={families}
      />
    </div>
  );
}
