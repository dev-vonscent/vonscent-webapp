import type {
  Concentration,
  Gender,
  ScentFamily,
  Season,
  TagKind,
} from "@/db/types";

/** A priced decant size for a product. */
export interface Variant {
  id: string;
  ml: number;
  /**
   * Effective charged price in integer ₮ — the discounted figure when the
   * admin set one, else the base price (0054). Everything that charges,
   * sums or reports money uses this.
   */
  price: number;
  /**
   * The admin's base price (`product_variants.price`). Equal to `price` when
   * the size is not discounted; higher when it is, and then it is the
   * crossed-out figure the storefront shows.
   */
  basePrice: number;
  isActive: boolean;
  /**
   * Can this size actually be filled from the remaining source ml?
   * (requirement_fb.md: "сав нь дууссан тохиолдолд 20мл-ийг идэвхгүй болгох").
   * A size the admin left active still sells out on its own once the bottle
   * can no longer cover it.
   */
  inStock: boolean;
}

export interface ProductImage {
  url: string;
  alt: string;
}

/** Compact shape used in catalog grids and home rails. */
export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gender: Gender;
  concentration: Concentration;
  /** Admin-assigned scent families (slugs from `scent_families`). */
  scentFamilies: ScentFamily[];
  /** Seasons this scent suits; empty = unspecified, "all" = year-round. */
  seasons: Season[];
  image: ProductImage | null;
  /** Lowest active variant price — discounts included (display "from …"). */
  startingPrice: number;
  /**
   * Base price of the same size `startingPrice` came from (0054). Greater than
   * `startingPrice` only when that size is discounted, which is exactly when a
   * card shows a crossed-out price. No percent is ever shown (backlog B4).
   */
  startingBasePrice: number;
  tags: TagKind[];
  /** Админы «Онцлох» тэмдэг (0055) — нүүрийн онцлох хэсэг үүгээр бүрдэнэ. */
  isFeatured: boolean;
  soldOut: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

/** Full product detail page payload. */
export interface ProductDetail extends ProductListItem {
  /** Four-part description (0022) — any part may be empty. */
  description: string;
  notesDescription: string;
  usageDescription: string;
  shortDescription: string;
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  originCountry: string | null;
  releaseYear: number | null;
  images: ProductImage[];
  variants: Variant[];
  /** Available source ml (on_hand - reserved). */
  availableMl: number;
  bottleMl: number;
  /** Free-form internal tag names (0035) — search fodder, never badges. */
  customTags: string[];
  /** Matching slugs (stable ids) — quiz weights and similarity match on these. */
  customTagSlugs: string[];
}

/** One row of the admin-managed scent family taxonomy. */
export interface ScentFamilyOption {
  slug: string;
  label: string;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * One row of the admin-managed brand list (0050_brands.sql).
 *
 * `name` is the string that lands on `products.brand` and is displayed
 * everywhere; the row exists so the name has one owner and can carry a logo.
 */
export interface BrandOption {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogFilters {
  brand?: string[];
  gender?: Gender[];
  family?: ScentFamily[];
  season?: Season[];
  tags?: TagKind[];
  /** Зөвхөн «Онцлох» гэж тэмдэглэсэн бараа. */
  featured?: boolean;
  ml?: number[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: "new" | "price_asc" | "price_desc" | "name" | "popular";
  page?: number;
  perPage?: number;
}

export interface CatalogResult {
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
}
