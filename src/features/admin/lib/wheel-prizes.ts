import { ASSUMED_AOV } from "@/lib/constants";
import type { SpinPrizeKind, SpinTier, SpinWheelPrizeRow } from "@/db/types";

/**
 * Азын хүрдний шагналын засвар (0170) — админы хүснэгт ба popup хоёулаа
 * хэрэглэнэ. Хүрд = жагсаалт дарааллаараа; хадгалах бүрд бүтэн жагсаалт
 * `admin_save_spin_prizes`-д очно.
 */

export const KIND_LABEL: Record<SpinPrizeKind, string> = {
  none: "Хоосон",
  points: "V point",
  coupon_percent: "Купон (%)",
  coupon_fixed: "Купон (₮)",
  product: "Бодит бараа",
  bundle: "Гранд 2мл багц",
};

export const KIND_ORDER: SpinPrizeKind[] = [
  "points",
  "coupon_fixed",
  "coupon_percent",
  "product",
  "bundle",
  "none",
];

export const TIER_LABEL: Record<SpinTier, string> = {
  common: "Энгийн",
  rare: "Ховор",
  grand: "Гранд",
};

/** Editable copy of a prize — every numeric field is a string while typing. */
export interface PrizeDraft {
  id: string | null;
  kind: SpinPrizeKind;
  tier: SpinTier;
  label: string;
  shortLabel: string;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  /** Chance in percent. */
  weight: string;
  monthlyCap: string;
  productId: string | null;
  ml: number | null;
}

/** What a new prize of `kind` starts as. */
const KIND_DEFAULTS: Record<SpinPrizeKind, Partial<PrizeDraft>> = {
  none: { label: "Хоосон", weight: "9" },
  points: { label: "1,000 V point", shortLabel: "1,000V", value: "1000" },
  coupon_percent: { label: "5% хөнгөлөлт", shortLabel: "5%", value: "5" },
  coupon_fixed: {
    label: "5,000₮ хөнгөлөлт",
    shortLabel: "5,000₮",
    value: "5000",
    minSubtotal: "100000",
  },
  product: { label: "", tier: "rare" },
  bundle: {
    label: "2мл таних багц",
    shortLabel: "2мл багц",
    value: "1",
    tier: "grand",
  },
};

export function blankDraft(kind: SpinPrizeKind): PrizeDraft {
  return {
    id: null,
    kind,
    tier: "common",
    label: "",
    shortLabel: "",
    value: "0",
    minSubtotal: "0",
    maxDiscount: "",
    weight: "0",
    monthlyCap: "",
    productId: null,
    ml: null,
    ...KIND_DEFAULTS[kind],
  };
}

export function toDraft(row: SpinWheelPrizeRow): PrizeDraft {
  return {
    id: row.id,
    kind: row.kind,
    tier: row.tier,
    label: row.label,
    shortLabel: row.short_label,
    value: String(row.value),
    minSubtotal: String(row.min_subtotal),
    maxDiscount: row.max_discount == null ? "" : String(row.max_discount),
    weight: String(Number(row.weight)),
    monthlyCap: row.monthly_cap == null ? "" : String(row.monthly_cap),
    productId: row.product_id ?? null,
    ml: row.ml ?? null,
  };
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const optional = (v: string) => (v.trim() === "" ? null : Math.trunc(num(v)));

export const isCoupon = (kind: SpinPrizeKind) =>
  kind === "coupon_fixed" || kind === "coupon_percent";

/** One row as the PUT sends it — only the fields its kind uses. */
export function toPayload(d: PrizeDraft) {
  const product = d.kind === "product";
  const coupon = isCoupon(d.kind);
  return {
    id: d.id,
    kind: d.kind,
    tier: d.tier,
    label: d.label.trim(),
    shortLabel: d.kind === "none" ? "" : d.shortLabel.trim(),
    value: d.kind === "none" ? 0 : product ? 1 : Math.trunc(num(d.value)),
    minSubtotal: coupon ? Math.trunc(num(d.minSubtotal)) : 0,
    maxDiscount: coupon ? optional(d.maxDiscount) : null,
    weight: num(d.weight),
    monthlyCap: optional(d.monthlyCap),
    productId: product ? d.productId : null,
    ml: product ? d.ml : null,
  };
}

/** Why a prize can't be saved yet, or null. */
export function problemOf(d: PrizeDraft): string | null {
  if (!d.label.trim()) return "Нэр бичнэ үү";
  const w = num(d.weight);
  if (d.weight.trim() === "" || w < 0 || w > 100)
    return "Магадлал 0–100 хооронд";
  if (d.kind === "product" && (!d.productId || !d.ml))
    return "Бараа ба хэмжээг сонгоно уу";
  if ((d.kind === "points" || d.kind === "coupon_fixed") && num(d.value) <= 0)
    return "Утга 0-ээс их байх ёстой";
  if (d.kind === "coupon_percent" && (num(d.value) <= 0 || num(d.value) > 100))
    return "Хувь 1–100 байна";
  return null;
}

/** The short line under a prize's name: what exactly is won. */
export function prizeDetail(row: SpinWheelPrizeRow): string {
  const fmt = (n: number) => n.toLocaleString("mn-MN");
  switch (row.kind) {
    case "coupon_fixed":
    case "coupon_percent":
      return [
        KIND_LABEL[row.kind],
        row.min_subtotal > 0 ? `≥${fmt(row.min_subtotal)}₮` : "доод хязгааргүй",
        row.max_discount ? `дээд ${fmt(row.max_discount)}₮` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "product":
      return `${KIND_LABEL.product}${row.ml ? ` · ${row.ml}мл` : ""}`;
    default:
      return KIND_LABEL[row.kind];
  }
}

/**
 * Нэг хожилтын нэрлэсэн үнэ ₮-өөр — «дундаж шагнал / эргэлт»-д л.
 * Хувийн купоныг ASSUMED_AOV дээр (дээд хязгаараар тагласан), бодит барааг
 * тэр хэмжээний каталогийн үнээр (`productPrice`); гранд багцыг оруулахгүй.
 */
export function nominalWorth(
  row: SpinWheelPrizeRow,
  productPrice: number,
): number {
  if (row.kind === "points" || row.kind === "coupon_fixed") return row.value;
  if (row.kind === "product") return productPrice;
  if (row.kind !== "coupon_percent") return 0;
  const full = (ASSUMED_AOV * row.value) / 100;
  return row.max_discount ? Math.min(full, row.max_discount) : full;
}
