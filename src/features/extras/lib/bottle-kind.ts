import type { ExtraMode } from "../types";

/**
 * Үнэртний шилний гурван төрөл (plan §18.1). Ангилал + горимоос гарна:
 *   empty    — «Хоосон шил»: үнэртэн нь декантаар зарагдсан, шил л үлдсэн;
 *   sealed   — «Шилтэй ус» / local_quantity: нээгээгүй, худалдаж авсан шил;
 *   leftover — «Шилтэй ус» / leftover_liquid: декант цутгадаг эх шил.
 * Админ нэмэх, засах үед гурвыг андуурахгүйн тулд tile, маягтын толгой,
 * өртгийн дүрэм бүгд эндээс уншина.
 */
export type BottleKind = "empty" | "sealed" | "leftover";

export function bottleKind(
  categorySlug: string,
  mode: ExtraMode,
): BottleKind | null {
  if (categorySlug === "empty-bottle") return "empty";
  if (categorySlug === "bottled")
    return mode === "leftover_liquid" ? "leftover" : "sealed";
  return null;
}

export const BOTTLE_KIND: Record<
  BottleKind,
  {
    title: string;
    /** Энэ юу вэ — tile ба маягтын толгойд. */
    summary: string;
    /** Тайланд хэрхэн тусах. */
    report: string;
    /** Шилний дүрсний дүүргэлт (0–1). */
    fill: number;
  }
> = {
  empty: {
    title: "Хоосон шил",
    summary: "Үнэртэн нь декантаар зарагдаж, шил нь л үлдсэн.",
    report: "Өртөггүй — авсан үнэ асуухгүй, тайланд зөвхөн борлуулалт орно.",
    fill: 0,
  },
  sealed: {
    title: "Бүтэн, лацтай шил",
    summary: "Нээгээгүй шинэ шил. Худалдаж аваад бүтнээр нь зарна.",
    report:
      "Нөөц нэмэхэд нэгж авсан үнэ асууна — тайланд зарлага, зарагдахад орлого.",
    fill: 1,
  },
  leftover: {
    title: "Үлдэгдэлтэй шил",
    summary: "Декант цутгадаг эх шил, дотор нь үнэртэн үлдсэн. Ганц ширхэг.",
    report:
      "Үлдсэн ml эх үнэртний нөөцөөс түгжигдэнэ. Шингэний өртөг эх савны худалдан авалтаар аль хэдийн орсон.",
    fill: 0.4,
  },
};

/** Хоосон шилэнд худалдан авалтын өртөг байхгүй — нөөц нь зөвхөн тоо. */
export function isCostless(kind: BottleKind | null) {
  return kind === "empty";
}
