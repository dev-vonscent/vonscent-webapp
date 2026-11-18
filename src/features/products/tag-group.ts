import type { CatalogFilters } from "@/lib/types";

/** Каталогийн «Таг» бүлгийн шүүлтүүр — `tags`, `featured`, `event`. */
export type TagGroupFilters = Pick<CatalogFilters, "tags" | "featured" | "event">;

/** Нэг мөр (бараа/багц) бүлгийн гишүүн бүрт таарах эсэх. */
export interface TagGroupMatch {
  /** Сонгосон таг бүрт (`sale`, `new`, `hot` …) таарах эсэх. */
  tag: (tag: NonNullable<CatalogFilters["tags"]>[number]) => boolean;
  featured: boolean;
  /** `?event=` арга хэмжээнд (LIVE) орсон эсэх. */
  event: (slug: string) => boolean;
}

/**
 * «Таг» бүлэг (арга хэмжээ, Онцлох, Шинэ, Эрэлттэй, Хямдралтай) дотроо OR:
 * сонгосон аль нэгэнд орсон мөр таарна. Юу ч сонгоогүй бол шүүлтгүй.
 * Бусад бүлэгтэй AND нь дуудагч талд.
 *
 * SQL-ийн толь: `catalog_search` (0194) — хоёулаа зэрэг өөрчлөгдөх ёстой.
 */
export function matchesTagGroup(
  f: TagGroupFilters,
  m: TagGroupMatch,
): boolean {
  const tags = f.tags ?? [];
  const event = f.event || null;
  if (!tags.length && !f.featured && !event) return true;
  return (
    tags.some((t) => m.tag(t)) ||
    (f.featured === true && m.featured) ||
    (event != null && m.event(event))
  );
}
