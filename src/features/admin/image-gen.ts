import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Add a generated image to a product's gallery **without touching the existing
 * images** (approve / revert, ai-image-generation §5b, §14.5). It appends at the
 * end (or becomes the first image when the gallery is empty), so a product that
 * already had photos keeps them. Duplicate URLs are ignored.
 */
export async function addGalleryImage(
  supabase: SupabaseClient,
  productId: string,
  url: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .eq("url", url)
    .maybeSingle();
  if (existing) return; // already in the gallery

  const { data: prod } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle();
  const alt = (prod as { name?: string } | null)?.name ?? "";

  const { data: last } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder =
    ((last as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  await supabase.from("product_images").insert({
    product_id: productId,
    url,
    alt,
    sort_order: nextOrder,
  });
}
