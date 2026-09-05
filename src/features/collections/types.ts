import type { Gender, ScentFamily, Season, TagKind } from "@/db/types";
import type { ProductImage } from "@/lib/types";

/** A perfume in a collection. The ml is chosen bundle-wide, so a member carries
 * its price + stock for every size the shop sells. */
export interface CollectionMember {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  image: ProductImage | null;
  /** price + availability keyed by ml (5/10/20). */
  variantByMl: Record<
    number,
    { variantId: string; price: number; inStock: boolean }
  >;
}

/** Bundle price at one ml — the sum of member prices, discounted and rounded. */
export interface CollectionPriceAtMl {
  ml: number;
  /** Σ member prices at this ml (pre-discount). */
  memberSum: number;
  /** Эцсийн үнэ: тогтмол үнэ, эсвэл нийлбэрээс хувь хассан дүн. */
  price: number;
  /**
   * Бодит хэмнэлтийн хувь (`memberSum` → `price`). Админы бичсэн хувь биш —
   * тогтмол үнэтэй хэмжээнд тэр хувь худал болно.
   */
  discountPct: number;
  /** memberSum − price. */
  saved: number;
  /** Every member has an active, in-stock variant at this ml. */
  available: boolean;
}

/** A base or saved-custom collection resolved with live member data. */
export interface Collection {
  id: string;
  slug: string;
  type: "base" | "custom";
  name: string;
  gender: Gender;
  description: string;
  /** Default %, applied to any size without its own override. */
  discountPct: number;
  /** Per-size overrides, keyed by ml (0051). Empty when the default rules all. */
  mlDiscounts: Record<number, number>;
  /**
   * Хэмжээ бүрийн тогтмол үнэ (0054, B6). Тухайн хэмжээ энд байвал хувийн
   * тооцоо огт хийгдэхгүй — админы бичсэн үнэ нь эцсийн үнэ.
   */
  mlPrices: Record<number, number>;
  /** Span of the discounts actually on offer — «5-10%» on a card. */
  discountRange: { min: number; max: number };
  /** Customer-facing badges, shared with products. */
  tags: TagKind[];
  /** Cover image (collection.image_url, or the first member's image). */
  image: string | null;
  isActive: boolean;
  isFeatured: boolean;
  members: CollectionMember[];
  /** Price per sellable ml, ascending. */
  prices: CollectionPriceAtMl[];
  /** ml sizes where the whole bundle is buyable. */
  availableMls: number[];
  /** Cheapest buyable bundle price (0 when nothing is available). */
  startingPrice: number;
  /** True once no ml is fully in stock / any member is inactive. */
  soldOut: boolean;
}

/** A product offered in the custom-bundle builder, with price/stock per ml.
 * Carries the catalog filter/sort fields so the builder can reuse the catalog
 * filters (brand, gender, family, season, tags, price). */
export interface BuilderProduct {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  gender: Gender;
  image: ProductImage | null;
  soldOut: boolean;
  availableMl: number;
  variantByMl: Record<
    number,
    { variantId: string; price: number; inStock: boolean }
  >;
  scentFamilies: ScentFamily[];
  seasons: Season[];
  tags: TagKind[];
  startingPrice: number;
  createdAt: string;
  ratingCount: number;
}

/** Admin-tunable collection settings (settings.collection). */
export interface CollectionSettings {
  customEnabled: boolean;
  minItems: number;
  maxItems: number | null;
  customDiscountPct: number;
  baseDefaultDiscountPct: number;
  roundTo: number;
}

export const DEFAULT_COLLECTION_SETTINGS: CollectionSettings = {
  customEnabled: true,
  minItems: 4,
  maxItems: null,
  customDiscountPct: 5,
  baseDefaultDiscountPct: 5,
  roundTo: 100,
};
