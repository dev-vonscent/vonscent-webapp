import type { ExtraSaveInput } from "@/lib/validators/extras";
import type { AdminExtra, ExtraMode } from "../../types";

/**
 * Маягтын төлөв. Тоон талбарууд мөр (string) — хоосон талбарыг «0» гэж
 * чимээгүй солихгүй, «Үнэ оруулна уу» гэж хэлэхийн тулд.
 */
export interface DraftVariant {
  /** React-ийн түлхүүр — шинэ мөрөнд id байхгүй. */
  key: string;
  id?: string;
  label: string;
  price: string;
  isActive: boolean;
  sort: number;
  /** Грамын сав. */
  vialId?: string;
}

export interface DraftLeftover {
  productId: string;
  productName: string;
  productBrand: string;
  productImage: string | null;
  productAvailableMl: number;
  remainingMl: string;
  fullMl: string;
}

export interface ExtraDraft {
  mode: ExtraMode;
  name: string;
  description: string;
  images: string[];
  sort: number;
  capacity: string;
  variants: DraftVariant[];
  leftover: DraftLeftover | null;
  /** Үлдэгдэлтэй шилний ганц үнэ. */
  leftoverPrice: string;
  leftoverVariantId?: string;
}

let seq = 0;
export function newKey() {
  seq += 1;
  return `new-${seq}`;
}

export function emptyDraft(mode: ExtraMode): ExtraDraft {
  return {
    mode,
    name: "",
    description: "",
    images: [],
    sort: 0,
    capacity: "",
    variants:
      mode === "local_quantity"
        ? [
            {
              key: newKey(),
              label: "",
              price: "",
              isActive: true,
              sort: 0,
            },
          ]
        : [],
    leftover: null,
    leftoverPrice: "",
  };
}

export function draftOf(extra: AdminExtra): ExtraDraft {
  const leftoverVariant =
    extra.mode === "leftover_liquid" ? extra.variants[0] : undefined;
  return {
    mode: extra.mode,
    name: extra.name,
    description: extra.description,
    images: extra.images,
    sort: extra.sort,
    capacity: extra.capacity != null ? String(extra.capacity) : "",
    variants:
      extra.mode === "leftover_liquid"
        ? []
        : extra.variants.map((v) => ({
            key: v.id,
            id: v.id,
            label: v.label,
            price: String(v.price),
            isActive: v.isActive,
            sort: v.sort,
            vialId: v.vialId ?? undefined,
          })),
    leftover: extra.leftover
      ? {
          productId: extra.leftover.productId,
          productName: extra.leftover.productName,
          productBrand: extra.leftover.productBrand,
          productImage: extra.leftover.productImage,
          productAvailableMl: extra.leftover.productAvailableMl,
          remainingMl: String(extra.leftover.remainingMl),
          fullMl: String(extra.leftover.fullMl),
        }
      : null,
    leftoverPrice: leftoverVariant ? String(leftoverVariant.price) : "",
    leftoverVariantId: leftoverVariant?.id,
  };
}

/** Хоосон мөрийг NaN болгоно — Zod «Үнэ оруулна уу» гэнэ. */
function num(v: string | number): number {
  if (typeof v === "number") return v;
  const t = v.replace(/[\s,]/g, "");
  return t === "" ? Number.NaN : Number(t);
}

/** Маягт → API-ийн хэлбэр (`extraSaveSchema`). Шалгалтыг Zod хийнэ. */
export function toSavePayload(d: ExtraDraft): ExtraSaveInput {
  const base = {
    name: d.name,
    description: d.description,
    images: d.images,
    sort: d.sort,
  };
  switch (d.mode) {
    case "local_quantity":
      return {
        mode: "local_quantity",
        ...base,
        capacity: d.capacity.trim() ? num(d.capacity) : null,
        variants: d.variants.map((v, i) => ({
          id: v.id,
          label: v.label,
          price: num(v.price),
          isActive: v.isActive,
          sort: i,
        })),
      };
    case "shared_vial":
      return {
        mode: "shared_vial",
        ...base,
        variants: d.variants.map((v, i) => ({
          id: v.id,
          vialId: v.vialId ?? "",
          price: num(v.price),
          isActive: v.isActive,
          sort: i,
        })),
      };
    case "leftover_liquid":
      return {
        mode: "leftover_liquid",
        ...base,
        productId: d.leftover?.productId ?? "",
        remainingMl: num(d.leftover?.remainingMl ?? ""),
        fullMl: num(d.leftover?.fullMl ?? ""),
        variantId: d.leftoverVariantId,
        price: num(d.leftoverPrice),
      };
  }
}
