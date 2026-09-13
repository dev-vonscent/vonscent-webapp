import { createAdminClient } from "@/lib/supabase/admin";
import {
  CollectionAdmin,
  type AdminCollection,
} from "@/features/admin/components/collection-admin";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const supabase = createAdminClient();
  let collections: AdminCollection[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("collections")
      .select(
        "id, slug, name, gender, description, discount_pct, image_url, is_active, is_featured, collection_items ( product_id, sort_order )",
      )
      .eq("type", "base")
      .order("is_featured", { ascending: false })
      .order("name");
    collections = (data as AdminCollection[] | null) ?? [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Багц"
        count={collections.length}
        description="Бэлэн багц үүсгэх, засах — 4 үнэртэн, хэмжээ тус бүрийн хямдрал. Бэлгийн 1мл дээж нь тусдаа «Бэлгийн үнэрүүд» хуудсаар удирдагдана."
      />
      <CollectionAdmin collections={collections} />
    </div>
  );
}
