import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCollectionSettings } from "@/features/collections/api";
import { getProductOptions } from "@/features/admin/api";
import { fetchCustomTags } from "@/features/taxonomy/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { CollectionForm } from "@/features/admin/components/collection-form";
import type { AdminCollection } from "@/features/admin/components/collection-admin";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  if (!supabase) notFound();

  const [customTagPool, settings, { data }] = await Promise.all([
    fetchCustomTags(),
    getCollectionSettings(),
    supabase
      .from("collections")
      .select(
        `id, slug, name, gender, description, discount_pct, image_url,
         is_active, is_featured,
         collection_items ( product_id, sort_order ),
         collection_ml_discounts ( ml, discount_pct, price ),
         collection_tags ( tags ( slug ) ),
         collection_custom_tags ( custom_tags ( slug ) )`,
      )
      .eq("type", "base")
      .eq("id", id)
      .maybeSingle(),
  ]);
  const collection = data as AdminCollection | null;
  if (!collection) notFound();

  // Гишүүд (нэрээрээ харагдах ёстой) + сонгогчийн эхний хуудас. Өмнө нь энд
  // БҮХ каталог ирж, браузар руу бүтнээрээ дамждаг байв.
  const memberIds = (collection.collection_items ?? []).map(
    (i) => i.product_id,
  );
  const [members, firstPage] = await Promise.all([
    getProductOptions({ ids: memberIds }),
    getProductOptions({}),
  ]);
  const seen = new Set(members.map((p) => p.id));
  const options = [...members, ...firstPage.filter((p) => !seen.has(p.id))];

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
        products={options}
        customTagPool={customTagPool}
        roundTo={settings.roundTo}
        defaultDiscountPct={settings.baseDefaultDiscountPct}
      />
    </div>
  );
}
