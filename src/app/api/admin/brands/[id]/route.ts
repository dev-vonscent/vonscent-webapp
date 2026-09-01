import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { brandUpdateSchema, brandSlug } from "@/lib/validators/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Edit one brand — rename, logo, order, or hide it.
 *
 * Renaming rewrites `products.brand` for every product pointing here, but that
 * happens in the database (the `brands_name_sync` trigger from 0050) rather
 * than in a second statement, so the two can never end up half-applied.
 *
 * There is no DELETE. `products.brand_id` is `on delete set null`, so removing
 * a row would quietly orphan products while leaving their brand text behind;
 * `isActive: false` takes it out of the picker and keeps the history readable.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = brandUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const input = parsed.data;
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const slug = brandSlug(input.name);
    if (!slug) return NextResponse.json({ error: "BAD_NAME" }, { status: 400 });
    update.name = input.name;
    // The slug follows the name so the two never drift apart; nothing links to
    // it by URL, so re-deriving it is safe.
    update.slug = slug;
  }
  if (input.logoUrl !== undefined) update.logo_url = input.logoUrl;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  if (!Object.keys(update).length) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("brands").update(update).eq("id", id);
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
