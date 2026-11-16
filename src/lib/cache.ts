import { revalidatePath, revalidateTag } from "next/cache";
import {
  CACHE_TAG_CATALOG,
  CACHE_TAG_STOCK,
  CACHE_TAG_TAXONOMY,
} from "./cache-tags";

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
 * Захиалгын нөлөөлсөн хүрээ — `stockScopeForOrder()` (src/lib/orders/stock-scope.ts)
 * захиалгын мөрүүдээс бүрдүүлнэ.
 */
export interface StockScope {
  productSlugs?: string[];
  collectionSlugs?: string[];
}

/**
 * Захиалга үүсэх / цуцлагдах / төлбөрөөс татгалзах нь зөвхөн нөөц, үлдэгдлийг
 * (дууссан эсэх) өөрчилдөг. `revalidatePublic()` нь `revalidatePath("/",
 * "layout")`-ээр блог, FAQ, about зэрэг БҮХ хуудсыг цэвэрлэж, захиалга бүрт
 * сайт бүхэлдээ дахин бичигддэг байсан — энэ нь зөвхөн үлдэгдэл харуулдаг
 * газрыг цэвэрлэнэ.
 *
 * Үргэлж:
 *  - `CACHE_TAG_STOCK` — каталогийн хайлт, facet (үлдэгдэлтэй кэш) ба
 *    тэдгээрийг уншсан хуудсууд (нүүрний rail, «Дууссан»);
 *  - нүүр (`/`).
 *
 * `scope` өгвөл (захиалга, цуцлалт, abandon) зөвхөн тэр захиалгын барааны
 * хуудсууд ба тэдгээрийг агуулсан багцын хуудсууд. Өгөөгүй бол (cron —
 * аль захиалга чөлөөлөгдсөнийг мэдэхгүй) өмнөх өргөн хүрээ: `CACHE_TAG_CATALOG`,
 * барааны ба багцын хуудас бүр.
 *
 * Scope-той үед `CACHE_TAG_CATALOG`-ийг САНААТАЙ цэвэрлэхгүй: савны түгжээ
 * (`getBottleLocks`) энэ tag-тай бөгөөд барааны хуудас бүр түүнийг уншдаг тул
 * Next тэр tag-ийг хуудас бүрийн ISR бичилтэд наадаг — цэвэрлэвэл бүх барааны
 * хуудас дахин бичигдэж, нарийсгалт утгаа алдана. Энэ tag-ийн үлдсэн кэш
 * (түгжээ, «Тун удахгүй») захиалгаар өөрчлөгддөггүй.
 *
 * Бусад барааны хуудасны «Төстэй ус» дахь дууссан тэмдэг хамгийн ихдээ ISR-ийн
 * хугацаагаар (1 цаг) хоцорно — checkout үлдэгдлийг серверт дахин шалгадаг.
 */
export function revalidateStock(scope?: StockScope) {
  revalidateTag(CACHE_TAG_STOCK, "max");
  revalidatePath("/");

  if (!scope) {
    revalidateTag(CACHE_TAG_CATALOG, "max");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/collections");
    revalidatePath("/collections/[slug]", "page");
    return;
  }

  for (const slug of new Set(scope.productSlugs ?? [])) {
    revalidatePath(`/products/${slug}`);
  }
  const collections = new Set(scope.collectionSlugs ?? []);
  if (collections.size > 0) {
    // Жагсаалтын карт гишүүн усны үлдэгдлээр «дууссан» болдог.
    revalidatePath("/collections");
    for (const slug of collections) revalidatePath(`/collections/${slug}`);
  }
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

/** Бэлэн багцын сэтгэгдэл (0107) — багцын хуудас ба жагсаалт. */
export function revalidateCollectionReviews(slug: string | null) {
  if (slug) revalidatePath(`/collections/${slug}`);
  revalidatePath("/collections");
}
