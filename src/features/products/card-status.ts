import type { TagKind } from "@/db/types";
import type { CatalogFilters } from "@/lib/types";

export type CardStatus = "hot" | "new" | "featured";

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  hot: "Эрэлттэй",
  new: "Шинэ",
  featured: "Онцлох",
};

const DEFAULT_ORDER: CardStatus[] = ["hot", "new", "featured"];

/**
 * Card-ын зураг дээр нэг л төлөв — бүгдийг нь давхарлахад дөрвөн badge
 * зургийн гуравны нэгийг далдалж байв (клиент, 2026-10). «Хямдрал» төлөв
 * биш — тусдаа badge-ээр.
 *
 * `prefer` нь хэрэглэгчийн харж буй жагсаалт: «Онцлох» шүүлтүүр/хэсэгт card
 * бүр «Онцлох» гэж гарна. Эс тэгвээс зарим нь «Эрэлттэй» гарч, онцлох дунд
 * өөр бараа холилдсон мэт харагддаг байв. Үлдсэн нь Эрэлттэй → Шинэ → Онцлох.
 */
export function cardStatus(
  item: { tags: readonly TagKind[]; isFeatured: boolean },
  prefer: readonly CardStatus[] = [],
): CardStatus | null {
  const has = (s: CardStatus) =>
    s === "featured" ? item.isFeatured : item.tags.includes(s);
  return [...prefer, ...DEFAULT_ORDER].find(has) ?? null;
}

/** Каталогийн шүүлтүүрээс: сонгосон төлөвүүд card дээр түрүүлнэ. */
export function preferredStatuses(filters: CatalogFilters): CardStatus[] {
  const out: CardStatus[] = [];
  if (filters.featured) out.push("featured");
  for (const t of filters.tags ?? []) if (t !== "sale") out.push(t);
  return out;
}
