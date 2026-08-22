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
  /** Effective charged price in integer ₮ (override ?? auto). */
  price: number;
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
  /** Lowest active variant price (display "from …"). */
  startingPrice: number;
  tags: TagKind[];
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
}

/** One row of the admin-managed scent family taxonomy. */
export interface ScentFamilyOption {
  slug: string;
  label: string;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogFilters {
  brand?: string[];
  gender?: Gender[];
  family?: ScentFamily[];
  season?: Season[];
  tags?: TagKind[];
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
