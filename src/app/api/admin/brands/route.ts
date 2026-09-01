import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { brandCreateSchema, brandSlug } from "@/lib/validators/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandOption } from "@/lib/types";

/**
 * Create a brand (admin → Брэнд, and the «шинэ брэнд» dialog on the product
 * form).
 *
 * Returns the created row, not just `ok`: the product form opens this dialog
 * mid-edit and has to select the new brand immediately: without the row back
 * it would have to refetch the whole list to learn the id it just made.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = brandCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const input = parsed.data;
  const slug = brandSlug(input.name);
  if (!slug) {
    // A name of nothing but punctuation or non-Latin script leaves no slug.
    return NextResponse.json({ error: "BAD_NAME" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug,
      name: input.name,
      logo_url: input.logoUrl ?? null,
      sort_order: input.sortOrder ?? 0,
      is_active: true,
    })
    .select("id, slug, name, logo_url, sort_order, is_active")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    // 23505 = unique_violation on slug: this house is already in the list.
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    // 42P01 = no brands table — 0050 hasn't run yet.
    if (code === "42P01")
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  const row = data as {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    sort_order: number;
    is_active: boolean;
  };
  const brand: BrandOption = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };

  revalidatePublic();
  return NextResponse.json({ ok: true, brand });
}
