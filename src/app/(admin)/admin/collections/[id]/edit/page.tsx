import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAllProducts } from "@/features/products/api";
import { getCollectionSettings } from "@/features/collections/api";
import { fetchCustomTags } from "@/features/taxonomy/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { CollectionForm } from "@/features/admin/components/collection-form";
import type { AdminCollection } from "@/features/admin/components/collection-admin";
import { toAdminProducts } from "../../to-admin-products";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  if (!supabase) notFound();

  const [products, customTagPool, settings, { data }] = await Promise.all([
    getAllProducts(),
    fetchCustomTags(),
    getCollectionSettings(),
    supabase
      .from("collections")
      .select(
        `id, slug, name, gender, description, discount_pct, image_url, gift_ml,
         is_active, is_featured,
         collection_items ( product_id, sort_order ),
         collection_ml_discounts ( ml, discount_pct ),
         collection_tags ( tags ( slug ) ),
         collection_custom_tags ( custom_tags ( slug ) )`,
      )
      .eq("type", "base")
      .eq("id", id)
      .maybeSingle(),
  ]);
  const collection = data as AdminCollection | null;
  if (!collection) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/collections"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Багц руу буцах
      </Link>
      <h1 className="font-serif text-2xl font-semibold">Багц засах</h1>
      <CollectionForm
        collection={collection}
        products={toAdminProducts(products)}
        customTagPool={customTagPool}
        roundTo={settings.roundTo}
        defaultDiscountPct={settings.baseDefaultDiscountPct}
      />
    </div>
  );
}
