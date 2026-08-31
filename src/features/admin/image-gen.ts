import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Add a generated image to a product's gallery **without touching the existing
 * images**. It appends at the end (or becomes the first image when the gallery
 * is empty), so a product that already had photos keeps them.
 *
 * `visible` is the admin's storefront selection (0049). A generated image lands
 * hidden — it is in the gallery to be looked at, not published — while an
 * upload is visible, because choosing to upload a photo is already the choice
 * to show it.
 *
 * Returns the gallery row — the one just inserted, or the existing one when the
 * URL was already there.
 */
export interface GalleryRow {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
  is_visible: boolean;
}

export async function addGalleryImage(
  supabase: SupabaseClient,
  productId: string,
  url: string,
  visible = false,
): Promise<GalleryRow | null> {
  const { data: existing } = await supabase
    .from("product_images")
    .select("id, url, alt, sort_order, is_visible")
    .eq("product_id", productId)
    .eq("url", url)
    .maybeSingle();
  if (existing) return existing as GalleryRow; // already in the gallery

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

  const { data } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      url,
      alt,
      sort_order: nextOrder,
      is_visible: visible,
    })
    .select("id, url, alt, sort_order, is_visible")
    .single();
  return (data as GalleryRow | null) ?? null;
}
