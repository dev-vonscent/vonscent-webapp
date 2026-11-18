import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { collectionIdsOf, type OrderLineInput } from "./order-lines";

/**
 * Захиалгын мөрүүдийн багцын төрөл ба зураг — `buildOrderLines`-ийн
 * `baseCollectionIds` (бэлэн багц) ба багцын мөрийн зураг. Төлбөрийн хуудас,
 * `/order/[token]`, захиалгын и-мэйл нэг аргаар уншина.
 */
export async function loadBundleInfo(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  items: readonly Pick<OrderLineInput, "collection_id">[],
): Promise<{ baseIds: Set<string>; images: Map<string, string | null> }> {
  const ids = collectionIdsOf(items);
  if (ids.length === 0) return { baseIds: new Set(), images: new Map() };
  const { data } = await supabase
    .from("collections")
    .select("id, type, image_url")
    .in("id", ids);
  const rows =
    (data as { id: string; type: string; image_url: string | null }[] | null) ??
    [];
  return {
    baseIds: new Set(rows.filter((r) => r.type === "base").map((r) => r.id)),
    images: new Map(rows.map((r) => [r.id, r.image_url])),
  };
}
