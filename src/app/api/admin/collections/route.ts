import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { revalidatePublic } from "@/lib/cache";
import { collectionCreateSchema } from "@/lib/validators/collection";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/features/collections/slug";
import { writeCollectionChildren } from "./write-children";

export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ collections: [] });
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("collections")
    .select(
      "id, slug, name, gender, description, discount_pct, image_url, gift_ml, is_active, is_featured, collection_items ( product_id, sort_order )",
    )
    .eq("type", "base")
    .order("is_featured", { ascending: false })
    .order("name");
  return NextResponse.json({ collections: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = collectionCreateSchema.safeParse(body);
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
  const slug =
    input.slug ||
    `${slugify(input.name) || "bagts"}-${randomUUID().slice(0, 5)}`;

  const { data: coll, error } = await supabase
    .from("collections")
    .insert({
      slug,
      type: "base",
      user_id: null,
      name: input.name,
      gender: input.gender,
      description: input.description,
      discount_pct: input.discountPct,
      gift_ml: input.giftMl,
      image_url: input.imageUrl ?? null,
      is_active: input.isActive,
      is_featured: input.isFeatured,
    })
    .select("id")
    .single();
  if (error || !coll) {
    const code = (error as { code?: string })?.code;
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  const items = input.productIds.map((product_id, i) => ({
    collection_id: coll.id,
    product_id,
    sort_order: i + 1,
  }));
  const { error: itemsErr } = await supabase
    .from("collection_items")
    .insert(items);
  if (itemsErr) {
    await supabase.from("collections").delete().eq("id", coll.id);
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  await writeCollectionChildren(supabase, coll.id, {
    mlDiscounts: input.mlDiscounts,
    tags: input.tags,
    customTags: input.customTags,
  });

  revalidatePublic();
  return NextResponse.json({ id: coll.id, slug });
}
