import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { SHIPPING_ZONES } from "@/lib/constants";
import { getProductsByIds, getProductsByTag } from "@/features/products/api";
import type { HomeSectionRow } from "@/db/types";
import type { ProductListItem } from "@/lib/types";

/**
 * Content / settings data access (admin A8 + A10). Settings live in the
 * key/value `settings` table. Everything falls back
 * to sensible defaults so the storefront renders in demo mode.
 */

export interface PopupSlide {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string | null;
  /** ISO date strings; null = no bound. Slide shows only inside this window. */
  startsAt: string | null;
  endsAt: string | null;
  /**
   * Optional coupon code — the popup renders it as a styled copyable coupon
   * (questions.md №12: суурь кодыг бэлтгэж, агуулгыг админ бэлдэнэ).
   */
  couponCode?: string;
}

export interface PopupSettings {
  enabled: boolean;
  frequencyHours: number;
  slides: PopupSlide[];
}
export interface SocialSettings {
  instagram: string;
  facebook: string;
  phone: string;
  email: string;
}
export interface TeamMember {
  name: string;
  role: string;
  image: string;
}
export interface AboutSettings {
  story: string;
  values: { title: string; desc: string }[];
  team: TeamMember[];
}
export interface ShippingZone {
  /** Stable id (A/B/C/R/X). Absent on rows saved before codes existed, which
   *  then fall back to matching on `name` — see zoneKey(). */
  code?: string;
  name: string;
  fee: number;
  /** false = zone we don't serve; checkout refuses the order. Legacy rows
   *  without the field are treated as deliverable. */
  deliverable?: boolean;
  /** true = countryside; remind the customer to name a transport pickup point. */
  remote?: boolean;
  /**
   * adm2 p-codes (optionally `code:khoroo`) this zone covers, so the server
   * can derive the zone from the address instead of trusting the dropdown
   * (todo.md B5b). Empty / absent = the zone is only ever picked by hand.
   */
  areas?: string[];
}
export interface ShippingSettings {
  zones: ShippingZone[];
}
export interface LoyaltySettings {
  earnPer: number;
  earnPoints: number;
  redeemRate: number;
}
/**
 * Сар бүрийн бэлгийн sample (questions.md №2–3): the admin curates 4–8
 * perfumes; at checkout the buyer picks 1ml samples — one pick per full
 * 200,000₮ of goods value (after the coupon, before shipping).
 */
export interface GiftSettings {
  enabled: boolean;
  /** Product ids of this month's giftable perfumes (aim for 4–8). */
  productIds: string[];
}
export interface StoreSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export const DEFAULT_POPUP: PopupSettings = {
  enabled: false,
  frequencyHours: 24,
  slides: [],
};
export const DEFAULT_SOCIAL: SocialSettings = {
  instagram: "https://www.instagram.com/von_scent/",
  facebook: "https://www.facebook.com/vonscent",
  phone: "",
  email: "vonscent.store@gmail.com",
};
export const DEFAULT_ABOUT: AboutSettings = {
  story: "",
  values: [],
  team: [],
};
export const DEFAULT_SHIPPING: ShippingSettings = {
  zones: SHIPPING_ZONES.map((z) => ({ ...z })),
};
export const DEFAULT_LOYALTY: LoyaltySettings = {
  earnPer: 100,
  earnPoints: 1,
  redeemRate: 1,
};
export const DEFAULT_GIFT: GiftSettings = {
  enabled: true,
  productIds: [],
};
export const DEFAULT_STORE: StoreSettings = {
  name: "vonscent",
  phone: "",
  email: "vonscent.store@gmail.com",
  address: "Улаанбаатар",
};

/** Fetch all settings rows once per request and index by key. */
const fetchSettings = cache(async (): Promise<Record<string, unknown>> => {
  const supabase = createPublicClient();
  if (!supabase) return {};
  const { data } = await supabase.from("settings").select("key, value");
  const out: Record<string, unknown> = {};
  for (const row of (data as { key: string; value: unknown }[] | null) ?? []) {
    out[row.key] = row.value;
  }
  return out;
});

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await fetchSettings();
  const v = all[key];
  if (v == null || typeof v !== "object") return fallback;
  return { ...fallback, ...(v as object) } as T;
}

export const getPopupSettings = () => getSetting("popup", DEFAULT_POPUP);
export const getSocialSettings = async (): Promise<SocialSettings> => {
  // The 0013 seed left instagram/facebook as "", which would otherwise win
  // over the defaults in the merge — treat blank fields as unset.
  const stored = await getSetting("social", DEFAULT_SOCIAL);
  return {
    instagram: stored.instagram || DEFAULT_SOCIAL.instagram,
    facebook: stored.facebook || DEFAULT_SOCIAL.facebook,
    phone: stored.phone || DEFAULT_SOCIAL.phone,
    email: stored.email || DEFAULT_SOCIAL.email,
  };
};
export const getAboutSettings = () => getSetting("about", DEFAULT_ABOUT);
export const getShippingSettings = () =>
  getSetting("shipping", DEFAULT_SHIPPING);
export const getLoyaltySettings = () => getSetting("loyalty", DEFAULT_LOYALTY);
export const getStoreSettings = () => getSetting("store", DEFAULT_STORE);
export const getGiftSettings = () => getSetting("gift", DEFAULT_GIFT);

/** A curated home rail with its products already resolved (todo.md B7). */
export interface HomeSection {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  products: ProductListItem[];
}

/**
 * Home page rails the admin composes (0023_home_sections).
 *
 * A 'manual' section keeps the admin's exact order; a 'tag' section is the
 * old marketing-tag rail expressed as a row, so «Онцлох» and «Шинээр буусан»
 * can be reordered against each other. Empty sections are dropped rather than
 * rendering a heading with nothing under it.
 */
export async function getHomeSections(): Promise<HomeSection[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("home_sections")
    .select("*, home_section_products ( product_id, sort_order )")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows =
    (data as unknown as
      | (HomeSectionRow & {
          home_section_products: { product_id: string; sort_order: number }[];
        })[]
      | null) ?? [];
  if (rows.length === 0) return [];

  const sections: HomeSection[] = [];
  for (const row of rows) {
    let products: ProductListItem[];
    if (row.kind === "tag" && row.tag) {
      products = await getProductsByTag(row.tag, row.max_items);
    } else {
      const ordered = [...row.home_section_products].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      // getProductsByIds filters out inactive/deleted products, so re-apply
      // the admin's order (and the cap) on what survived.
      const found = await getProductsByIds(ordered.map((p) => p.product_id));
      const byId = new Map(found.map((p) => [p.id, p]));
      products = ordered
        .map((p) => byId.get(p.product_id))
        .filter((p): p is ProductListItem => Boolean(p))
        .slice(0, row.max_items);
    }
    if (products.length === 0) continue;
    sections.push({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      href: row.href,
      products,
    });
  }
  return sections;
}

