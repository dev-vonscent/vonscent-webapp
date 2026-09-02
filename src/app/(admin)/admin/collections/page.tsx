import { createAdminClient } from "@/lib/supabase/admin";
import {
  CollectionAdmin,
  type AdminCollection,
} from "@/features/admin/components/collection-admin";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const supabase = createAdminClient();
  let collections: AdminCollection[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("collections")
      .select(
        "id, slug, name, gender, description, discount_pct, image_url, gift_ml, is_active, is_featured, collection_items ( product_id, sort_order )",
      )
      .eq("type", "base")
      .order("is_featured", { ascending: false })
      .order("name");
    collections = (data as AdminCollection[] | null) ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Багц</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Бэлэн багц үүсгэх, засах — 4 үнэртэн, хямдрал, нэмэлт бэлэг.
        </p>
      </div>
      <CollectionAdmin collections={collections} />
    </div>
  );
}
