import { SIZE_HINTS, SPRAYS_PER_ML, type MlSize } from "@/lib/constants";
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
   * «Зарахгүй»). null бол зарагдаж байна → «≈ 75 цацалт».
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
  /** Энэ хэмжээ хямдралтай эсэх — карт дээрх тэмдэг (2.6). */
  onSale: boolean;
}

/** «≈ 75 цацалт» — нэг үнэртний ml-ээс (`SPRAYS_PER_ML`). */
export function spraysText(ml: number): string {
  return `≈ ${ml * SPRAYS_PER_ML} цацалт`;
}

/** Сонгосон хэмжээний доорх нэг мөр (`SIZE_HINTS`); жагсаалтад байхгүй бол null. */
export function sizeHint(ml: number | null | undefined): string | null {
  if (ml == null) return null;
  return SIZE_HINTS[ml as MlSize] ?? null;
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
    onSale: v.isActive && salePct(v.basePrice, v.price) > 0,
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
