import {
  SIZE_HINT_LARGEST,
  SIZE_HINT_TRIAL_BUNDLE,
  SIZE_HINTS,
  SPRAYS_PER_ML,
  type MlSize,
} from "@/lib/constants";
import type { Variant } from "@/lib/types";
import { salePct } from "./sale";

/**
 * Хэмжээ сонгогчийн нэг карт (task 15) — ус, бэлэн багц, quick-add бүгд энэ
 * хэлбэрт хөрвүүлээд `SizeSelector`-т өгнө. Карт дээр үнэ БАЙХГҮЙ: үнэ нь
 * дээрх үнийн хэсэгт (`SizePrice`) сонгосон хэмжээгээр л гарна.
 */
export interface SizeOption {
  /** Сонголтын түлхүүр — усанд variant id, багцад ml. */
  id: string;
  /** Нэг үнэртний ml — цацалтын тоо, доорх зөвлөмж үүгээр. */
  ml: number;
  /** Карт дээрх хэмжээ: «5ml», багцад «5ml ×4». */
  label: string;
  /**
   * Цацалтын тооны ОРОНД гарах төлөв («Дууссан», «Түр байхгүй»,
   * «Зарахгүй»). null бол зарагдаж байна → `sprays`.
   */
  note: string | null;
  /**
   * Дарж сонгож болох уу. Дууссан / савгүй хэмжээ СОНГОГДОНО (task 4 — үнэ
   * нь дээр харагдана, товч идэвхгүй); зөвхөн админы хаасан / бүрэн бус
   * хэмжээ сонгогдохгүй.
   */
  selectable: boolean;
  /** Өнөөдөр худалдан авч болох уу. */
  buyable: boolean;
  /**
   * Энэ хэмжээний хямдралын хувь (0 = хямдралгүй) — карт дээрх «−15%»
   * тэмдэг (2.6). Үнийн хэсгийн хувьтай ижил эх үүсвэр.
   */
  salePct: number;
  /** «75 цацалт», багцад «тус бүр 75 цацалт». */
  sprays: string;
  /** Багц — цацалт үнэртэн тус бүрийнх (2ml-ийн зөвлөмжийн текст). */
  each: boolean;
  /** Одоогийн бодит үнэ (₮) — 1ml-ийн үнийн харьцуулалтад. */
  price: number;
  /** Нийт ml (усанд = `ml`, багцад `ml × гишүүдийн тоо`). */
  totalMl: number;
}

/**
 * «75 цацалт» — нэг үнэртний ml-ээс (`SPRAYS_PER_ML`). Багцад
 * «тус бүр 75 цацалт» (үнэртэн бүрт).
 */
export function spraysText(ml: number, each = false): string {
  return `${each ? "тус бүр " : ""}${ml * SPRAYS_PER_ML} цацалт`;
}

/**
 * Энэ хэмжээний 1ml-ийн үнэ (одоогийн бодит үнээр) бүх ЗАРАХ хэмжээнээс
 * (админы «Зарахгүй»-г тооцохгүй; нөөцөөс үл хамааран — хэмжээний шинж)
 * хамгийн бага (тэнцүүг оруулна) эсэх.
 */
export function isCheapestPerMl(
  options: readonly SizeOption[],
  target: SizeOption,
): boolean {
  if (!(target.price > 0 && target.totalMl > 0)) return false;
  // a/b ≤ c/d ⇔ a·d ≤ c·b — бутархай үүсгэхгүй.
  return options
    .filter((o) => o.selectable && o.price > 0 && o.totalMl > 0)
    .every((o) => target.price * o.totalMl <= o.price * target.totalMl);
}

/** Зөвлөмжийн мөрийн icon-ийн төрөл — UI (`SizeHintRow`) icon-оо сонгоно. */
export type SizeHintKind = "trial" | "pocket" | "travel" | "value" | "largest";

const HINT_KIND: Record<MlSize, SizeHintKind> = {
  2: "trial",
  5: "pocket",
  10: "travel",
  20: "value",
};

/**
 * Сонгосон хэмжээний доорх нэг мөр (`SIZE_HINTS`). `{sprays}` нь картын
 * цацалтын тоотой ижил томьёо. 20ml-ийн «хамгийн хямдаар» нь 1ml-ийн үнэ нь
 * үнэхээр хамгийн бага үед л; үгүй бол `SIZE_HINT_LARGEST`. Багцын 2ml —
 * `SIZE_HINT_TRIAL_BUNDLE`. Жагсаалтад байхгүй хэмжээ → null.
 */
export function sizeHint(
  options: readonly SizeOption[],
  selected: SizeOption | null | undefined,
): { text: string; kind: SizeHintKind } | null {
  if (!selected) return null;
  const ml = selected.ml as MlSize;
  const template =
    ml === 2 && selected.each ? SIZE_HINT_TRIAL_BUNDLE : SIZE_HINTS[ml];
  if (!template) return null;
  if (ml === 20 && !isCheapestPerMl(options, selected)) {
    return { text: SIZE_HINT_LARGEST, kind: "largest" };
  }
  const text = template.replace("{sprays}", String(ml * SPRAYS_PER_ML));
  return { text, kind: HINT_KIND[ml] };
}

/**
 * Усны хэмжээнүүд → карт. Бүх хэмжээ харагдана (админы хаасан нь
 * «Зарахгүй», сонгогдохгүй) — эгнээнд цоорхой гарахгүй.
 */
export function productSizeOptions(
  variants: readonly Pick<
    Variant,
    | "id"
    | "ml"
    | "price"
    | "basePrice"
    | "isActive"
    | "sellable"
    | "unavailableReason"
  >[],
): SizeOption[] {
  return variants.map((v) => ({
    id: v.id,
    ml: v.ml,
    label: `${v.ml}ml`,
    note: !v.isActive
      ? "Зарахгүй"
      : v.sellable
        ? null
        : // Савны түгжээ (0095) нь ТҮР зуурынх — үлдэгдэл дуусахаас өөр үг.
          v.unavailableReason === "bottle"
          ? "Түр байхгүй"
          : "Дууссан",
    selectable: v.isActive,
    buyable: v.sellable,
    salePct: v.isActive ? salePct(v.basePrice, v.price) : 0,
    sprays: spraysText(v.ml),
    each: false,
    price: v.price,
    totalMl: v.ml,
  }));
}

/**
 * Анхдагч сонголт: зарагдаж буй ХАМГИЙН ЭХНИЙ (жижиг) хэмжээ; нэг ч
 * зарагдахгүй бол сонгож болох эхнийх. Дууссан хэмжээг урьдчилж сонговол
 * хэрэглэгч идэвхгүй товчтой үлдэнэ.
 */
export function defaultSizeId(options: readonly SizeOption[]): string {
  return (
    (options.find((o) => o.buyable) ?? options.find((o) => o.selectable))?.id ??
    ""
  );
}
