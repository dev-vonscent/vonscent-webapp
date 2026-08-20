import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCollectionSettings } from "@/features/collections/api";
import { slugify } from "@/features/collections/slug";

const schema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().default(""),
  gender: z.enum(["male", "female", "unisex"]).default("unisex"),
  productIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const { name, description, gender, productIds } = parsed.data;

  // Distinct products, at least the configured minimum.
  const ids = [...new Set(productIds)];
  const settings = await getCollectionSettings();
  if (ids.length < settings.minItems) {
    return NextResponse.json({ error: "TOO_FEW" }, { status: 400 });
  }
  if (settings.maxItems != null && ids.length > settings.maxItems) {
    return NextResponse.json({ error: "TOO_MANY" }, { status: 400 });
  }

  const slug = `${slugify(name) || "bagts"}-${randomUUID().slice(0, 6)}`;

  // Owner RLS lets a customer insert their own custom collection.
  const { data: coll, error } = await supabase
    .from("collections")
    .insert({
      slug,
      type: "custom",
      user_id: user.id,
      name,
      gender,
      description,
      discount_pct: settings.customDiscountPct,
      is_active: true,
      is_featured: false,
    })
    .select("id")
    .single();
  if (error || !coll) {
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }

  const items = ids.map((product_id, i) => ({
    collection_id: coll.id,
    product_id,
    sort_order: i + 1,
  }));
  const { error: itemsErr } = await supabase
    .from("collection_items")
    .insert(items);
  if (itemsErr) {
    // Roll back the header so we don't leave an empty collection behind.
    await supabase.from("collections").delete().eq("id", coll.id);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ id: coll.id, slug });
}
