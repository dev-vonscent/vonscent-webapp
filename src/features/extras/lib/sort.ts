import type { ShopExtraListItem } from "../api";

export const EXTRA_SORTS = [
  "recommended",
  "price_asc",
  "price_desc",
] as const;
export type ExtraSort = (typeof EXTRA_SORTS)[number];

export const EXTRA_SORT_LABEL: Record<ExtraSort, string> = {
  recommended: "Санал болгох",
  price_asc: "Үнэ: бага → их",
  price_desc: "Үнэ: их → бага",
};

/** `CatalogSort`-ийн сонголт. */
export const EXTRA_SORT_OPTIONS = EXTRA_SORTS.map((value) => ({
  value,
  label: EXTRA_SORT_LABEL[value],
}));

export function parseExtraSort(v: unknown): ExtraSort {
  return (EXTRA_SORTS as readonly unknown[]).includes(v)
    ? (v as ExtraSort)
    : "recommended";
}

/**
 * «Шинэ эхэндээ» байхгүй (клиент, 2026-11-10): шил бүр ганц ширхэг шахуу,
 * «шинэ» гэх ойлголт хэрэглэгчид хамаагүй. «Санал болгох» нь админы
 * дарааллын дараа шинийг эхэнд тавьдаг хэвээр; хуучин `?sort=new` холбоос
 * «Санал болгох» руу унана.
 *
 * Дууссан бараа ямагт сүүлд — «Санал болгох» нь админы дараалал (`sort`).
 * Эх жагсаалтыг өөрчлөхгүй.
 */
export function sortExtras<
  T extends Pick<
    ShopExtraListItem,
    "soldOut" | "fromPrice" | "sort" | "createdAt" | "categorySort"
  >,
>(items: readonly T[], sort: ExtraSort): T[] {
  const by: Record<ExtraSort, (a: T, b: T) => number> = {
    recommended: (a, b) =>
      a.categorySort - b.categorySort ||
      a.sort - b.sort ||
      b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => a.fromPrice - b.fromPrice,
    price_desc: (a, b) => b.fromPrice - a.fromPrice,
  };
  return [...items].sort(
    (a, b) => Number(a.soldOut) - Number(b.soldOut) || by[sort](a, b),
  );
}
