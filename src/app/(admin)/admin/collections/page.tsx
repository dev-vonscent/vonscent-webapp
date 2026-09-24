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
  let generatingIds: string[] = [];
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

    // Хуудас нээгдэхэд аль хэдийн үүсч байгаа AI зургууд — loader-ийг эхний
    // polling хүлээлгүй шууд харуулна.
    const { data: jobs } = await supabase
      .from("collection_image_generations")
      .select("collection_id")
      .in("status", ["pending", "generating"]);
    generatingIds = [
      ...new Set(
        ((jobs ?? []) as { collection_id: string }[]).map(
          (j) => j.collection_id,
        ),
      ),
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Багц" count={collections.length} />
      <CollectionAdmin
        collections={collections}
        generatingIds={generatingIds}
      />
    </div>
  );
}
