import "server-only";
import { cache } from "react";
import type { ScentFamilyOption } from "@/lib/types";
import { DEFAULT_SCENT_FAMILIES } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

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

/** Every family, including deactivated ones (admin view). */
export const fetchScentFamilies = cache(
  async (): Promise<ScentFamilyOption[]> => {
    if (!isSupabaseConfigured) return DEMO_FAMILIES;
    const supabase = await createClient();
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
