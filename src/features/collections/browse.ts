import { bundleSaleEndsAt } from "./pricing";
import type { CollectionCardData } from "./types";

/**
 * «Бэлэн багцууд» (/collections) хуудасны эрэмбэ ба арга хэмжээний шүүлт —
 * `CollectionBrowser`-ийн цэвэр логик (client дээр ажиллана, server render-т
 * цаг/санамсаргүй зүйл оролцохгүй).
 */

export type CollectionSort =
  | "featured"
  | "price_asc"
  | "price_desc"
  | "discount";

export const COLLECTION_SORTS: { value: CollectionSort; label: string }[] = [
  { value: "featured", label: "Онцлох эхэндээ" },
  { value: "price_asc", label: "Үнэ: бага → их" },
  { value: "price_desc", label: "Үнэ: их → бага" },
  // Каталогийн 2.7-той ижил нэр, ижил логик (хувиар).
  { value: "discount", label: "Хямдрал: их → бага" },
];

/**
 * URL-ын `sort` → эрэмбэ. Хуучин «Хэмнэлт: их → бага» (`sort=saved`, ₮-ээр
 * эрэмбэлдэг байсан) холбоос шинэ «Хямдрал: их → бага» руу буна.
 */
export function parseCollectionSort(v: string | null): CollectionSort {
  if (v === "saved") return "discount";
  return COLLECTION_SORTS.some((o) => o.value === v)
    ? (v as CollectionSort)
    : "featured";
}

type Sortable = Pick<
  CollectionCardData,
  "isFeatured" | "startingPrice" | "discountRange" | "event"
>;

/**
 * Эрэмбэлсэн ШИНЭ массив (тогтвортой — тэнцсэн нь оролтын дарааллаараа).
 *
 * «Хямдрал: их → бага»: багцын бодит хувь (`discountRange.max` — LIVE арга
 * хэмжээ суурь хувийг greatest-ээр орлосон, хэмжээ бүр өөр бол хамгийн их),
 * тэнцвэл арга хэмжээ дуусах мөч ойр нь эхэнд (хугацаагүй нь ард). Хэмнэх ₮
 * биш — үнэтэй 5%-тай багц хямд 10%-тай багцын дунд орохгүй.
 */
export function sortCollections<T extends Sortable>(
  list: readonly T[],
  sort: CollectionSort,
): T[] {
  const end = (c: T) => {
    const iso = bundleSaleEndsAt(c);
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };
  return [...list].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return a.startingPrice - b.startingPrice;
      case "price_desc":
        return b.startingPrice - a.startingPrice;
      case "discount": {
        const d = b.discountRange.max - a.discountRange.max;
        if (d !== 0) return d;
        const ea = end(a);
        const eb = end(b);
        return ea === eb ? 0 : ea < eb ? -1 : 1;
      }
      default:
        return Number(b.isFeatured) - Number(a.isFeatured);
    }
  });
}

/**
 * Арга хэмжээний chip-ийн шүүлт: `slug` нь LIVE, бэлэн багцтай арга хэмжээ
 * (`liveSlugs` — `useBundleSaleEvents`, туг `sale_event_bundles` хаалттай бол
 * хоосон) байвал л тэр арга хэмжээний багцууд; эс бөгөөс шүүлтгүй (дууссан
 * event, хаалттай туг, гараар бичсэн параметр хуудсыг хоосолохгүй).
 */
export function filterByEvent<T extends Pick<CollectionCardData, "event">>(
  list: readonly T[],
  slug: string | null,
  liveSlugs: readonly string[],
): T[] {
  if (!slug || !liveSlugs.includes(slug)) return [...list];
  return list.filter((c) => c.event?.slug === slug);
}
