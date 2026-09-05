import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { productEditSchema } from "@/lib/validators/product";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveBrandId,
  sanitizeCustomTags,
  sanitizeFamilies,
} from "@/features/taxonomy/api";

async function guard() {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const };
  return { supabase };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) {
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );
  }
  const { supabase } = g;
  const input = parsed.data;

  const productUpdate: Record<string, unknown> = {};
  if (input.name !== undefined) productUpdate.name = input.name;
  if (input.brand !== undefined) {
    productUpdate.brand = input.brand;
    // Keep the pointer in step with the text, so a later rename in the brand
    // list reaches this product too (0050 brands_name_sync).
    productUpdate.brand_id = await resolveBrandId(input.brand);
  }
  if (input.gender !== undefined) productUpdate.gender = input.gender;
  if (input.concentration !== undefined)
    productUpdate.concentration = input.concentration;
  if (input.scentFamilies !== undefined)
    productUpdate.scent_families = await sanitizeFamilies(input.scentFamilies);
  if (input.seasons !== undefined) productUpdate.seasons = input.seasons;
  if (input.notesTop !== undefined) productUpdate.notes_top = input.notesTop;
  if (input.notesHeart !== undefined)
    productUpdate.notes_heart = input.notesHeart;
  if (input.notesBase !== undefined) productUpdate.notes_base = input.notesBase;
  if (input.description !== undefined)
    productUpdate.description = input.description;
  if (input.notesDescription !== undefined)
    productUpdate.notes_description = input.notesDescription;
  if (input.usageDescription !== undefined)
    productUpdate.usage_description = input.usageDescription;
  if (input.shortDescription !== undefined)
    productUpdate.short_description = input.shortDescription;
  if (input.originCountry !== undefined)
    productUpdate.origin_country = input.originCountry;
  if (input.releaseYear !== undefined)
    productUpdate.release_year = input.releaseYear;
  if (input.isActive !== undefined) productUpdate.is_active = input.isActive;
  if (input.isFeatured !== undefined)
    productUpdate.is_featured = input.isFeatured;
  if (input.bottlePrice !== undefined)
    productUpdate.bottle_price = input.bottlePrice;
  if (input.bottleMl !== undefined) productUpdate.bottle_ml = input.bottleMl;

  if (Object.keys(productUpdate).length > 0) {
    const { error } = await supabase
      .from("products")
      .update(productUpdate)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }
  }

  // Per-size price + on-sale flag. Prices are typed by hand, so the bottle
  // price above never moves them. Upsert so a size the product didn't have
  // yet (e.g. the 2ml sample tier on an older product) can be added here.
  if (input.variants !== undefined) {
    for (const v of input.variants) {
      await supabase.from("product_variants").upsert(
        {
          product_id: id,
          ml: v.ml,
          price: v.price,
          // 0 буюу хоосон = хямдрал байхгүй. Мөрийг үргэлж бичих нь чухал —
          // тэгэхгүй бол хямдралыг цуцлах арга байхгүй болно.
          sale_price: v.salePrice && v.salePrice > 0 ? v.salePrice : null,
          is_active: v.active,
        },
        { onConflict: "product_id,ml" },
      );
    }
  }

  // Low-stock threshold.
  if (input.lowStockMl !== undefined) {
    await supabase
      .from("inventory")
      .update({ low_stock_ml: input.lowStockMl })
      .eq("product_id", id);
  }

  // Tags: replace the whole set.
  if (input.tags !== undefined) {
    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, slug")
      .in("slug", input.tags.length ? input.tags : ["__none__"]);
    await supabase.from("product_tags").delete().eq("product_id", id);
    const links = (
      (tagRows as { id: string; slug: string }[] | null) ?? []
    ).map((t) => ({ product_id: id, tag_id: t.id }));
    if (links.length) await supabase.from("product_tags").insert(links);
  }

  // Free-form internal tags (A2 «Нэмэлт Tag»): replace the whole set.
  if (input.customTags !== undefined) {
    const slugs = await sanitizeCustomTags(input.customTags);
    const { data: ctRows } = await supabase
      .from("custom_tags")
      .select("id, slug")
      .in("slug", slugs.length ? slugs : ["__none__"]);
    await supabase.from("product_custom_tags").delete().eq("product_id", id);
    const links = ((ctRows as { id: string }[] | null) ?? []).map((t) => ({
      product_id: id,
      tag_id: t.id,
    }));
    if (links.length) await supabase.from("product_custom_tags").insert(links);
  }

  revalidatePublic();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) {
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );
  }
  const { error } = await g.supabase.from("products").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
