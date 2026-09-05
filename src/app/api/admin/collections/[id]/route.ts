import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { collectionUpdateSchema } from "@/lib/validators/collection";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeCollectionChildren } from "../write-children";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = collectionUpdateSchema.safeParse(body);
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
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.description !== undefined) patch.description = input.description;
  if (input.discountPct !== undefined) patch.discount_pct = input.discountPct;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;

  if (Object.keys(patch).length) {
    const { error } = await supabase
      .from("collections")
      .update(patch)
      .eq("id", id)
      .eq("type", "base");
    if (error)
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  // Replace members when a new roster is supplied. Validate the new roster
  // BEFORE deleting the old one (audit R3): the FK failure that used to leave
  // a collection member-less can now only happen in the narrow window between
  // this check and the insert.
  if (input.productIds) {
    const { data: found, error: checkError } = await supabase
      .from("products")
      .select("id")
      .in("id", input.productIds);
    if (
      checkError ||
      ((found as { id: string }[] | null) ?? []).length !==
        new Set(input.productIds).size
    ) {
      return NextResponse.json({ error: "UNKNOWN_PRODUCT" }, { status: 400 });
    }

    const { error: delError } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", id);
    if (delError)
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });

    const items = input.productIds.map((product_id, i) => ({
      collection_id: id,
      product_id,
      sort_order: i + 1,
    }));
    const { error } = await supabase.from("collection_items").insert(items);
    if (error)
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  await writeCollectionChildren(supabase, id, {
    mlDiscounts: input.mlDiscounts,
    tags: input.tags,
    customTags: input.customTags,
  });

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("type", "base");
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
