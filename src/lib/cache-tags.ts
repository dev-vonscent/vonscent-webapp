/**
 * Cache tags for the cross-request data cache (`unstable_cache`).
 *
 * Kept in their own module because `revalidatePublic()` and the feature `api.ts`
 * files both need them, and importing either direction would drag
 * `server-only` product code into the cache helper.
 */

/** Catalog facets: brand list, price bounds. */
export const CACHE_TAG_CATALOG = "catalog";
/** Admin-owned taxonomy: scent families, brands. */
export const CACHE_TAG_TAXONOMY = "taxonomy";
