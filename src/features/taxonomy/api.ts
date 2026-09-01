import "server-only";
import { cache } from "react";
import type { BrandOption, ScentFamilyOption } from "@/lib/types";
import { DEFAULT_SCENT_FAMILIES } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Scent family taxonomy (0018_scent_families.sql).
 *
 * The admin owns this list — Тохиргоо → Үнэрийн төрөл adds and removes rows —
 * so both the catalog filter and the product forms render from here instead of
 * a hard-coded array. Falls back to the seeded defaults in demo mode.
 */

const DEMO_FAMILIES: ScentFamilyOption[] = DEFAULT_SCENT_FAMILIES.map(
  (f, i) => ({
    slug: f.slug,
    label: f.label,
    iconUrl: f.iconUrl,
    sortOrder: i + 1,
    isActive: true,
  }),
);

interface DbScentFamily {
  slug: string;
  label: string;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}

/** One entry of the admin-managed free-form tag pool (0035_custom_tags). */
export interface CustomTagOption {
  id: string;
  name: string;
  slug: string;
}

/** The whole custom-tag pool, alphabetical. Empty in demo mode. */
export const fetchCustomTags = cache(async (): Promise<CustomTagOption[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("custom_tags")
    .select("id, name, slug")
    .order("name", { ascending: true });
  return (data as CustomTagOption[] | null) ?? [];
});

/** Keep only slugs that exist in the pool (product form defense). */
export async function sanitizeCustomTags(slugs: string[]): Promise<string[]> {
  if (!slugs.length) return [];
  const pool = new Set((await fetchCustomTags()).map((t) => t.slug));
  return [...new Set(slugs)].filter((s) => pool.has(s));
}

/** Every family, including deactivated ones (admin view). */
export const fetchScentFamilies = cache(
  async (): Promise<ScentFamilyOption[]> => {
    if (!isSupabaseConfigured) return DEMO_FAMILIES;
    const supabase = createPublicClient();
    if (!supabase) return DEMO_FAMILIES;

    const { data, error } = await supabase
      .from("scent_families")
      .select("slug, label, icon_url, sort_order, is_active")
      .order("sort_order", { ascending: true });

    if (error || !data) return DEMO_FAMILIES;
    return (data as unknown as DbScentFamily[]).map((r) => ({
      slug: r.slug,
      label: r.label,
      iconUrl: r.icon_url,
      sortOrder: r.sort_order,
      isActive: r.is_active,
    }));
  },
);

/** Only the families customers should see in the catalog filter. */
export async function getScentFamilies(): Promise<ScentFamilyOption[]> {
  return (await fetchScentFamilies()).filter((f) => f.isActive);
}

/**
 * Drop family slugs that aren't in the taxonomy. `products.scent_families` is
 * a text[] and cannot carry a foreign key, so this is where the referential
 * check happens before a write.
 */
export async function sanitizeFamilies(slugs: string[]): Promise<string[]> {
  const known = new Set((await fetchScentFamilies()).map((f) => f.slug));
  return [...new Set(slugs)].filter((s) => known.has(s));
}

/**
 * slug → label map for display. Unknown slugs (a family the admin removed but
 * that a product still carries) fall back to the raw slug rather than blank.
 */
export async function getScentFamilyLabels(): Promise<Record<string, string>> {
  const families = await fetchScentFamilies();
  return Object.fromEntries(families.map((f) => [f.slug, f.label]));
}

/* ── Brands (0050_brands.sql) ─────────────────────────────────────────────── */

interface DbBrand {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
}

/**
 * Every brand, hidden ones included (admin view).
 *
 * Ordered by `sort_order` then name so the admin can pin the houses they sell
 * most to the top of the product form's dropdown without renaming anything.
 * Empty in demo mode — the product form falls back to a free-text field there,
 * because a dropdown with nothing in it cannot be filled in.
 */
export const fetchBrands = cache(async (): Promise<BrandOption[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("brands")
    .select("id, slug, name, logo_url, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return ((data as DbBrand[] | null) ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    logoUrl: r.logo_url,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }));
});

/** Only the brands the admin still wants offered on the product form. */
export async function getActiveBrands(): Promise<BrandOption[]> {
  return (await fetchBrands()).filter((b) => b.isActive);
}

/**
 * The brand row a product's `brand` text belongs to, matched case-insensitively.
 *
 * The write path keeps both columns: `brand` because every reader already uses
 * it, `brand_id` because that is what a rename follows. A name the list does
 * not know yet returns null rather than failing the save — an operator typing
 * a new brand should not lose the product they were creating.
 */
export async function resolveBrandId(name: string): Promise<string | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const hit = (await fetchBrands()).find(
    (b) => b.name.trim().toLowerCase() === wanted,
  );
  return hit?.id ?? null;
}
