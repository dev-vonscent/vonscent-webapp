import { GENDER_LABEL, type Gender } from "@/lib/constants";

/** Бэлгийн мөрийн нэг бүлэг — `gender` null бол хүйс тодорхойгүй ус. */
export interface GenderGroup<T> {
  gender: Gender | null;
  label: string | null;
  items: T[];
}

/**
 * Сагсанд давамгайлж буй хүйс — эрэгтэй, эмэгтэй усны нийт ml-ийг
 * харьцуулна. Unisex аль талыг ч дэмжихгүй; тэнцүү эсвэл мэдээлэлгүй бол
 * `null` (өгөгдмөл дараалал).
 */
export function leadGender(
  lines: { productId: string; ml: number }[],
  genderOf: (productId: string) => Gender | undefined,
): "male" | "female" | null {
  let male = 0;
  let female = 0;
  for (const l of lines) {
    const g = genderOf(l.productId);
    if (g === "male") male += l.ml;
    else if (g === "female") female += l.ml;
  }
  if (male > female) return "male";
  if (female > male) return "female";
  return null;
}

/**
 * Бэлгийн уснуудыг хүйсээр бүлэглэнэ. Сагсны хүйс түрүүлж, Unisex үргэлж
 * дунд нь, эсрэг хүйс сүүлд — хэрэглэгч эхний хэдэн хавтаснаас өөртөө
 * тохирохыг олно. Хоосон бүлэг гарахгүй; бүлэг доторх дараалал хэвээр.
 */
export function groupByGender<T extends { gender?: Gender }>(
  products: T[],
  lead: "male" | "female" | null,
): GenderGroup<T>[] {
  const order: Gender[] =
    lead === "male"
      ? ["male", "unisex", "female"]
      : ["female", "unisex", "male"];
  const groups: GenderGroup<T>[] = order.map((gender) => ({
    gender,
    label: GENDER_LABEL[gender],
    items: products.filter((p) => p.gender === gender),
  }));
  groups.push({
    gender: null,
    label: null,
    items: products.filter((p) => !p.gender || !order.includes(p.gender)),
  });
  return groups.filter((g) => g.items.length > 0);
}

/** «эмэгтэй ус», «эрэгтэй ус», «unisex ус» — сонголтын баталгаажуулалтад. */
export function genderNoun(gender: Gender | undefined): string | null {
  return gender ? `${GENDER_LABEL[gender].toLowerCase()} ус` : null;
}
