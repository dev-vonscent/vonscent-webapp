import { NextResponse, after } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { productInputSchema } from "@/lib/validators/product";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { isStorageUrl } from "@/lib/storage/storage";
import {
  resolveBrandId,
  resolveConcentration,
  sanitizeCustomTags,
  sanitizeFamilies,
} from "@/features/taxonomy/api";
import { runNewProductImages } from "@/lib/ai/new-product-pipeline";
import { addBottleImage } from "@/features/admin/bottle-image";
import type { ProductStatus } from "@/lib/constants";

function slugify(name: string, brand: string) {
  return `${brand}-${name}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Demo mode: no DB — accept the payload, but don't persist.
  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  // Defense in depth: re-check staff role at the handler.
  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  }

  const slug = slugify(input.name, input.brand);
  const families = await sanitizeFamilies(input.scentFamilies);
  // `brand` stays the display text every reader uses; `brand_id` is what a
  // later rename in the brand list follows (0050). A name that isn't in the
  // list yet resolves to null rather than blocking the save.
  const brandId = await resolveBrandId(input.brand);
  // Төрөл нь `concentrations`-д FK-тэй (0085): танихгүй утга бол Postgres-ийн
  // 23503 болж унахаас өмнө энд ойлгомжтой хариу өгнө.
  const concentration = await resolveConcentration(input.concentration);
  if (!concentration) {
    return NextResponse.json(
      { error: "UNKNOWN_CONCENTRATION" },
      { status: 400 },
    );
  }

  const base = {
    slug,
    name: input.name,
    brand: input.brand,
    brand_id: brandId,
    description: input.description,
    notes_description: input.notesDescription,
    usage_description: input.usageDescription,
    notes_top: input.notesTop,
    notes_heart: input.notesHeart,
    notes_base: input.notesBase,
    gender: input.gender,
    concentration,
    sillage: input.sillage,
    // Хоосон текст = «бичээгүй». Хоосон мөр хадгалвал дэлгүүр хоосон мөр
    // харуулах эрсдэлтэй тул null болгож нэгтгэнэ (0083).
    longevity: input.longevity || null,
    origin_country: input.originCountry ?? null,
    release_year: input.releaseYear ?? null,
    bottle_price: input.bottlePrice,
    // `bottle_ml` нь 0027-оос хойш юунд ч нөлөөлдөггүй (үнэ гараар, үлдэгдэл
    // `inventory`-д) тул формд асуудаггүй. NOT NULL > 0 баганыг анхны
    // үлдэгдлээр бөглөнө.
    bottle_ml: Math.max(input.onHandMl, 1),
  };

  const hostedImages = input.images.filter((img) => isStorageUrl(img.url));
  // The reference bottle is persisted on the product whether or not a job runs
  // now, so a later regeneration always has the original to work from.
  const referenceImageUrl =
    input.referenceUrl && isStorageUrl(input.referenceUrl)
      ? input.referenceUrl
      : null;
  const aiMode =
    input.generateImage && isImageGenConfigured && Boolean(referenceImageUrl);

  // A product whose only picture is still being generated has nothing to show,
  // so it ends up hidden however the form's status was set — «Тун удахгүй» is
  // just as public as «Идэвхтэй». One that already carries uploaded gallery
  // images publishes on the admin's word.
  const finalStatus: ProductStatus =
    aiMode && hostedImages.length === 0 ? "hidden" : input.status;

  // Always born hidden: a coming-soon or active row is public the moment it
  // lands (RLS, 0125), and until its sizes, gallery and stock rows exist the
  // shop would show a card with no price and no picture. The requested status
  // is applied at the very end, once everything below has succeeded.
  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({
      ...base,
      scent_families: families,
      seasons: input.seasons,
      status: "hidden",
      coming_soon_note: input.comingSoonNote,
      is_featured: input.isFeatured,
      reference_image_url: referenceImageUrl,
    })
    .select("id")
    .single();

  if (pErr || !product) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }
  const productId = (product as { id: string }).id;

  /**
   * A half-built product is worse than none: the admin would retry and end up
   * with two. The row is still hidden here, so removing it (variants, images
   * and stock cascade) leaves the catalogue exactly as it was.
   */
  const abort = async (what: string) => {
    await supabase.from("products").delete().eq("id", productId);
    return NextResponse.json(
      {
        error: `${what} хадгалагдсангүй тул бараа үүссэнгүй. Дахин оролдоно уу.`,
      },
      { status: 500 },
    );
  };

  // Variants: the admin priced each size by hand, so store the figure as-is.
  // `sale_price` нь тухайн хэмжээний бодит хямдрал (0054) — хоосон бол null.
  const variants = input.variants.map((v) => ({
    product_id: productId,
    ml: v.ml,
    price: v.price,
    sale_price: v.salePrice && v.salePrice > 0 ? v.salePrice : null,
    is_active: v.active,
  }));

  const { error: vErr } = await supabase
    .from("product_variants")
    .insert(variants);
  if (vErr) return abort("Хэмжээ, үнэ");

  // Gallery images are the gallery, always — the AI reference is a separate
  // field now, so the two no longer compete for the same uploads.
  if (hostedImages.length) {
    const { error: iErr } = await supabase.from("product_images").insert(
      hostedImages.map((img, i) => ({
        product_id: productId,
        url: img.url,
        alt: img.alt || input.name,
        sort_order: i,
        is_visible: img.visible,
      })),
    );
    if (iErr) return abort("Зураг");
  }

  const { error: invErr } = await supabase.from("inventory").insert({
    product_id: productId,
    on_hand_ml: input.onHandMl,
    low_stock_ml: input.lowStockMl,
  });
  if (invErr) return abort("Үлдэгдэл");

  if (aiMode) {
    // Two pictures from the one uploaded bottle: the catalogue packshot, then
    // the note image shot from that packshot (lib/ai/new-product-pipeline.ts).
    // Runs after the response is sent — the admin lands on the table while the
    // images generate; the table polls until they're done (§6.3).
    // Сонгосон савны зураг AI-ийн хоёр зургийн дараа — 3 дахь байранд.
    after(async () => {
      await runNewProductImages(productId, referenceImageUrl!);
      if (input.bottleStyle) {
        await addBottleImage(
          supabase,
          productId,
          slug,
          input.bottleStyle,
          "third",
        );
      }
    });
  } else if (input.bottleStyle) {
    // Гараар оруулсан зургууд эхэлж, савны зураг хамгийн ард.
    await addBottleImage(supabase, productId, slug, input.bottleStyle, "end");
  }

  // Шинэ / Эрэлттэй / Хямдрал тагийг DB өөрөө тавина (0100, 0101, 0103).

  // Free-form internal tags (search / quiz pool, A2 «Нэмэлт Tag»).
  const customTags = await sanitizeCustomTags(input.customTags);
  if (customTags.length) {
    const { data: ctRows, error: ctErr } = await supabase
      .from("custom_tags")
      .select("id, slug")
      .in("slug", customTags);
    if (ctErr) return abort("Нэмэлт таг");
    const links = ((ctRows as { id: string }[] | null) ?? []).map((t) => ({
      product_id: productId,
      tag_id: t.id,
    }));
    if (links.length) {
      const { error: tErr } = await supabase
        .from("product_custom_tags")
        .insert(links);
      if (tErr) return abort("Нэмэлт таг");
    }
  }

  // Everything the shop shows is in place — now publish as asked. A failure
  // here leaves a complete product that is merely still hidden, so it is
  // reported as such rather than rolled back.
  let status: ProductStatus = "hidden";
  if (finalStatus !== "hidden") {
    const { error: sErr } = await supabase
      .from("products")
      .update({ status: finalStatus })
      .eq("id", productId);
    if (!sErr) status = finalStatus;
  }

  revalidatePublic();
  // `status` is what the product actually is now — the form tells the admin
  // when that differs from what they picked (AI images pending, publish failed).
  return NextResponse.json({ ok: true, id: productId, slug, status });
}
