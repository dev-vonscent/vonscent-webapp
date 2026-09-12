import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAG_CATALOG, CACHE_TAG_TAXONOMY } from "./cache-tags";

/**
 * Purge every cached public page (ISR). Admin mutation routes call this after
 * a successful write so storefront pages pick up the change on the next hit
 * instead of waiting out their `revalidate` window.
 *
 * `revalidatePath` does not reach the data cache, so the tagged facet and
 * taxonomy entries (products/api.ts, taxonomy/api.ts) are purged explicitly —
 * otherwise a new brand or scent family would sit out its own 5-minute window
 * before showing up in the catalog filter.
 */
export function revalidatePublic() {
  revalidatePath("/", "layout");
  // Next 16 takes a cache-life profile; "max" purges every entry for the tag
  // regardless of age, which is the old single-argument behaviour.
  revalidateTag(CACHE_TAG_CATALOG, "max");
  revalidateTag(CACHE_TAG_TAXONOMY, "max");
}

/**
 * Purge only what a review write actually changes: the product page (list +
 * rating), the catalog (rating stars on cards) and the home page (its recent
 * reviews strip). Deliberately *not* `revalidatePublic()` — a single customer
 * rating should not drop every cached page on the site.
 */
export function revalidateProductReviews(slug: string | null) {
  if (slug) revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  revalidatePath("/");
}
