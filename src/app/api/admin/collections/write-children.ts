import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeCustomTags } from "@/features/taxonomy/api";

/**
 * Write a bundle's per-size discounts and its two tag sets (0051).
 *
 * Shared by POST and PATCH because the rule is the same on both: each of the
 * three is **replaced wholesale** when the caller sends it, and left alone when
 * it does not. That distinction is what makes PATCH safe — a request that only
 * renames a bundle must not silently drop its tags — so every argument here is
 * optional and `undefined` means "not part of this request", while an empty
 * array means "clear it".
 */
export async function writeCollectionChildren(
  supabase: SupabaseClient,
  collectionId: string,
  input: {
    mlDiscounts?: { ml: number; discountPct: number }[];
    tags?: string[];
    customTags?: string[];
  },
): Promise<void> {
  if (input.mlDiscounts !== undefined) {
    await supabase
      .from("collection_ml_discounts")
      .delete()
      .eq("collection_id", collectionId);
    if (input.mlDiscounts.length) {
      await supabase.from("collection_ml_discounts").insert(
        input.mlDiscounts.map((d) => ({
          collection_id: collectionId,
          ml: d.ml,
          discount_pct: d.discountPct,
        })),
      );
    }
  }

  if (input.tags !== undefined) {
    await supabase
      .from("collection_tags")
      .delete()
      .eq("collection_id", collectionId);
    if (input.tags.length) {
      const { data: tagRows } = await supabase
        .from("tags")
        .select("id")
        .in("slug", input.tags);
      const links = ((tagRows as { id: string }[] | null) ?? []).map((t) => ({
        collection_id: collectionId,
        tag_id: t.id,
      }));
      if (links.length) await supabase.from("collection_tags").insert(links);
    }
  }

  if (input.customTags !== undefined) {
    await supabase
      .from("collection_custom_tags")
      .delete()
      .eq("collection_id", collectionId);
    // Slugs are filtered against the admin pool rather than trusted: the form
    // sends what the operator ticked, and an unknown slug would fail the FK.
    const clean = await sanitizeCustomTags(input.customTags);
    if (clean.length) {
      const { data: ctRows } = await supabase
        .from("custom_tags")
        .select("id")
        .in("slug", clean);
      const links = ((ctRows as { id: string }[] | null) ?? []).map((t) => ({
        collection_id: collectionId,
        tag_id: t.id,
      }));
      if (links.length)
        await supabase.from("collection_custom_tags").insert(links);
    }
  }
}
