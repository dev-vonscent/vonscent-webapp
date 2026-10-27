import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { productEditSchema } from "@/lib/validators/product";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveBrandId,
  resolveConcentration,
  sanitizeCustomTags,
  sanitizeFamilies,
} from "@/features/taxonomy/api";
import {
  LAUNCH_REQUIRED,
  NO_IMAGE,
  PUBLISHED_STATUSES,
  hasVisibleImage,
  statusConflict,
} from "@/features/admin/lib/product-status";
import { variantSaleColumns } from "@/features/products/sale";

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

  // Байхгүй бараа нь ямар ч хүсэлтэд 404. Үгүй бол `status:"active"` нь
  // нөхцөлтэй UPDATE-ийн хоосон үр дүнгээс болж 409 LAUNCH_REQUIRED, зөвхөн
  // `variants` нь FK алдаагаар 500 болж төөрөгдүүлнэ.
  const { data: existing, error: findErr } = await supabase
    .from("products")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Зураггүй барааг нийтлэхгүй. Зөвхөн төлөв ӨӨРЧЛӨГДӨЖ байхад — форм
  // төлөвийг үргэлж илгээдэг тул аль хэдийн нийтлэгдсэн (хуучин, зураггүй)
  // барааны бусад засварыг түгжихгүй.
  if (
    input.status !== undefined &&
    input.status !== existing.status &&
    PUBLISHED_STATUSES.includes(input.status)
  ) {
    const hasImage = await hasVisibleImage(supabase, id);
    if (hasImage === null) {
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }
    if (!hasImage) return NextResponse.json(NO_IMAGE, { status: 409 });
  }

  const productUpdate: Record<string, unknown> = {};
  if (input.name !== undefined) productUpdate.name = input.name;
  if (input.brand !== undefined) {
    productUpdate.brand = input.brand;
    // Keep the pointer in step with the text, so a later rename in the brand
    // list reaches this product too (0050 brands_name_sync).
    productUpdate.brand_id = await resolveBrandId(input.brand);
  }
  if (input.gender !== undefined) productUpdate.gender = input.gender;
  if (input.concentration !== undefined) {
    // `products.concentration` нь `concentrations.code`-д FK-тэй (0085).
    const concentration = await resolveConcentration(input.concentration);
    if (!concentration) {
      return NextResponse.json(
        { error: "UNKNOWN_CONCENTRATION" },
        { status: 400 },
      );
    }
    productUpdate.concentration = concentration;
  }
  if (input.sillage !== undefined) productUpdate.sillage = input.sillage;
  if (input.longevity !== undefined)
    productUpdate.longevity = input.longevity || null;
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
  if (input.originCountry !== undefined)
    productUpdate.origin_country = input.originCountry;
  if (input.releaseYear !== undefined)
    productUpdate.release_year = input.releaseYear;
  // Зөвхөн `status`-ийг бичнэ — `is_active`-ийг DB-ийн trigger дагуулна
  // (0125). Хоёуланг нь илгээвэл зөрөх эрсдэлтэй.
  if (input.status !== undefined) productUpdate.status = input.status;
  if (input.comingSoonNote !== undefined)
    productUpdate.coming_soon_note = input.comingSoonNote;
  if (input.isFeatured !== undefined)
    productUpdate.is_featured = input.isFeatured;
  if (input.bottlePrice !== undefined)
    productUpdate.bottle_price = input.bottlePrice;

  if (Object.keys(productUpdate).length > 0) {
    let query = supabase.from("products").update(productUpdate).eq("id", id);
    // «Тун удахгүй» → «Идэвхтэй» нь зөвхөн launch endpoint-оор. Урьдчилан
    // уншаад шалгах биш нөхцөлтэй UPDATE: уншсан, бичсэн хоёрын хооронд төлөв
    // солигдсон ч тойрох завсар үлдэхгүй.
    if (input.status === "active") query = query.neq("status", "coming_soon");
    const { data: updated, error } = await query.select("id");

    if (error) {
      // Нэг удаа гарсан барааг «Тун удахгүй» болгох гэх мэт дүрмийн зөрчил
      // (0125) — сервер биш, хүсэлт буруу: админд шалтгааныг нь хэлнэ.
      const conflict = statusConflict(error.message);
      if (conflict) return NextResponse.json(conflict, { status: 409 });
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }
    // Бараа дээр байгааг шалгасан тул хоосон үр дүн нь `neq`-д таарсан
    // «Тун удахгүй» бараа, эсвэл яг энэ хооронд устсан бараа.
    if (!updated?.length) {
      return input.status === "active"
        ? NextResponse.json(LAUNCH_REQUIRED, { status: 409 })
        : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
  }

  // Per-size price + on-sale flag. Prices are typed by hand, so the bottle
  // price above never moves them. Upsert so a size the product didn't have
  // yet (e.g. the 2ml sample tier on an older product) can be added here.
  if (input.variants !== undefined) {
    for (const v of input.variants) {
      const { error } = await supabase.from("product_variants").upsert(
        {
          product_id: id,
          ml: v.ml,
          price: v.price,
          ...variantSaleColumns(v),
          is_active: v.active,
        },
        { onConflict: "product_id,ml" },
      );
      // Чимээгүй алгасвал админ «хадгалагдлаа» гэж хараад хуучин үнээр
      // зарагдсаар байна. Өмнөх хэмжээнүүд бичигдсэн байж болно — бүхэлд нь
      // transaction-д оруулах нь тусдаа ажил (PLAN «Шийдвэрүүд»).
      if (error) {
        return NextResponse.json(
          { error: "VARIANT_UPDATE_FAILED", ml: v.ml },
          { status: 500 },
        );
      }
    }
  }

  // Low-stock threshold. Өмнө нь алдааг залгиад `ok` буцаадаг байв —
  // оператор «хадгалагдлаа» гэж хараад анхааруулга хэзээ ч ирэхгүй үлддэг.
  // Дараагийн хадгалалтыг (tag) тасалдуулахгүй — төгсгөлд нь мэдэгдэнэ.
  let lowStockFailed = false;
  if (input.lowStockMl !== undefined) {
    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .update({ low_stock_ml: input.lowStockMl })
      .eq("product_id", id)
      .select("product_id");
    lowStockFailed = Boolean(invErr) || !inv?.length;
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
  if (lowStockFailed) {
    // Dialog/форм `error`-г шууд харуулдаг тул операторын үгээр.
    return NextResponse.json(
      {
        error:
          "«Бага үлдэгдлийн босго» хадгалагдсангүй, бусад өөрчлөлт хадгалагдлаа. Дахин оролдоно уу.",
        code: "LOW_STOCK_UPDATE_FAILED",
      },
      { status: 500 },
    );
  }
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
