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
/** Feature flag (0133) — админ туг солиход `revalidateFeatureFlags()`. */
export const CACHE_TAG_FEATURE_FLAGS = "feature-flags";
/**
 * Үлдэгдлээс хамаардаг кэш — каталогийн хайлт (дууссан эсэх, эрэмбэ) ба facet
 * (`catalog_facets` нь зөвхөн зарагдах хэмжээний үнийг тоолно). Захиалга бүрт
 * `revalidateStock()` зөвхөн үүнийг цэвэрлэнэ. `CACHE_TAG_CATALOG` нь савны
 * түгжээ (`getBottleLocks`)-г агуулдаг тул барааны хуудас БҮР түүнийг
 * уншдаг — захиалга бүрт тэрийг цэвэрлэвэл бүх барааны хуудас дахин бичигдэнэ.
 * Эдгээр кэш хоёр tag-тай тул админы бичилт (`CACHE_TAG_CATALOG`) ч хүрнэ.
 */
export const CACHE_TAG_STOCK = "stock";
