import type {
  ExtraInventoryMode,
  ExtraProductStatus,
  LeftoverLockState,
  VialStyle,
} from "@/db/types";

/**
 * Нэмэлт бараа (extras-shop-plan §4). Нөөцийн горим нь ангиллаас ирж, UI,
 * checkout, нөөцийн код бүгд үүгээр салбарлана — ангиллын slug-аар биш.
 */
export type ExtraMode = ExtraInventoryMode;

export interface ExtraCategory {
  id: string;
  slug: string;
  name: string;
  mode: ExtraMode;
  imageUrl: string | null;
  sort: number;
}

/** Нийтлэхэд дутуу зүйлийн код — SQL `extras_readiness()`-тэй ижил. */
export type ExtraReadinessCode =
  | "NO_VARIANT"
  | "PRICE_MISSING"
  | "VIAL_NOT_COUNTED"
  | "VIAL_FLAG_OFF"
  | "LEFTOVER_SOLD";

/** Хоосон декант сав (0145). `onHand` null = тоолж эхлээгүй. */
export interface VialOption {
  id: string;
  style: VialStyle | null;
  ml: number;
  onHand: number | null;
  reserved: number;
  /** null = хязгааргүй (тоолж эхлээгүй); идэвхгүй бол 0. */
  available: number | null;
  lowThreshold: number;
  isActive: boolean;
  note: string;
  updatedAt: string;
}

export interface AdminExtraVariant {
  id: string;
  label: string;
  price: number;
  /** Энгийн бараанд «Нийт тоо», грамын савд савны нийт. */
  onHand: number | null;
  reserved: number;
  /** null = хязгааргүй. */
  available: number | null;
  vialId: string | null;
  isActive: boolean;
  sort: number;
  updatedAt: string;
}

export interface AdminLeftover {
  productId: string;
  productName: string;
  productBrand: string;
  productImage: string | null;
  /** Эх үнэртний декантад үлдсэн (түгжээгүй) ml. */
  productAvailableMl: number;
  remainingMl: number;
  fullMl: number;
  lockState: LeftoverLockState | null;
  lockedMl: number | null;
}

export interface AdminExtra {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  mode: ExtraMode;
  slug: string;
  name: string;
  description: string;
  images: string[];
  status: ExtraProductStatus;
  capacity: number | null;
  sort: number;
  variants: AdminExtraVariant[];
  leftover: AdminLeftover | null;
  /** Идэвхтэй хувилбаруудын хамгийн бага үнэ. */
  fromPrice: number | null;
  readiness: ExtraReadinessCode[];
  updatedAt: string;
}

/** Нөөцийн товч төлөв — жагсаалтын badge. */
export type ExtraStockBadge =
  | { kind: "ok"; available: number | null }
  | { kind: "low"; available: number }
  | { kind: "out" }
  | { kind: "leftover"; state: LeftoverLockState | null };

/** Дэлгүүрийн жагсаалтын нэг карт (каталогийн таб, ангилал, хайлт). */
export interface ShopExtraCard {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  mode: ExtraMode;
  image: string | null;
  /** Зарагдах хувилбаруудын хамгийн бага үнэ; бүгд дууссан бол бүх идэвхтэйнх. */
  fromPrice: number;
  soldOut: boolean;
  /** Үлдэгдэлтэй шил: эх үнэртэн ба ml. */
  leftover: {
    brand: string;
    productName: string;
    remainingMl: number;
    fullMl: number;
  } | null;
  /** Бэлгийн хайрцагт «N шил багтана». */
  capacity: number | null;
}

/** Барааны хуудасны нэг хувилбар (сонгох товч). */
export interface ShopExtraVariant {
  id: string;
  /** «Хар», «Ягаан 10ml»; ганц хувилбартай бол хоосон байж болно. */
  label: string;
  price: number;
  /** null = хязгааргүй; 0 = дууссан. */
  available: number | null;
}

export interface ShopExtraDetail {
  card: ShopExtraCard;
  description: string;
  images: string[];
  variants: ShopExtraVariant[];
  /** Үлдэгдэлтэй шилний эх үнэртний хуудас. */
  productSlug: string | null;
  productId: string | null;
  updatedAt: string;
}
