import type { AdminExtra, ExtraCategory } from "../types";
import { bottleKind } from "./bottle-kind";

/**
 * «Шилтэй ус» ангилал нь хоёр өөр бараа: лацтай шинэ шил (тусгай захиалж
 * авсан, нөөцөөс хасахгүй) ба үлдэгдэлтэй шил (декантын нөөцөөс ml
 * түгждэг). Админд нэг chip-д холилдож, мөрөнд «Шилтэй ус» гэж ижилхэн
 * харагддаг байсан тул горимоор нь салгана. Шүүлтийн түлхүүр: бусад ангилалд
 * slug, «Шилтэй ус»-д `bottled-sealed` / `bottled-leftover`.
 */
const BOTTLED_SPLIT = [
  { key: "bottled-sealed", label: "Бүтэн шил" },
  { key: "bottled-leftover", label: "Үлдэгдэлтэй шил" },
] as const;

export function extraFilterKey(e: Pick<AdminExtra, "categorySlug" | "mode">) {
  const kind = bottleKind(e.categorySlug, e.mode);
  if (kind === "sealed") return "bottled-sealed";
  if (kind === "leftover") return "bottled-leftover";
  return e.categorySlug;
}

/** Админы шүүлтийн chip-ийн дараалал: ангиллын дараалал, «Шилтэй ус» хоёр хуваагдана. */
export function extraFilterChips(categories: ExtraCategory[]) {
  return categories.flatMap((c) =>
    c.slug === "bottled"
      ? BOTTLED_SPLIT.map((b) => ({ key: b.key, label: b.label }))
      : [{ key: c.slug, label: c.name }],
  );
}

/** Мөрөнд харуулах төрлийн нэр — «Шилтэй ус»-ын оронд «Бүтэн шил» / «Үлдэгдэлтэй шил». */
export function extraKindName(
  e: Pick<AdminExtra, "categorySlug" | "mode" | "categoryName">,
) {
  const key = extraFilterKey(e);
  return BOTTLED_SPLIT.find((b) => b.key === key)?.label ?? e.categoryName;
}
