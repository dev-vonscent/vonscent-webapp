import { NextResponse, after } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { productInputSchema } from "@/lib/validators/product";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { isStorageUrl } from "@/lib/storage/storage";
import {
  resolveBrandId,
  sanitizeCustomTags,
  sanitizeFamilies,
} from "@/features/taxonomy/api";
import { runNewProductImages } from "@/lib/ai/new-product-pipeline";

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

  const base = {
    slug,
    name: input.name,
    brand: input.brand,
    brand_id: brandId,
    description: input.description,
    notes_description: input.notesDescription,
    usage_description: input.usageDescription,
    short_description: input.shortDescription,
    notes_top: input.notesTop,
    notes_heart: input.notesHeart,
    notes_base: input.notesBase,
    gender: input.gender,
    concentration: input.concentration,
    origin_country: input.originCountry ?? null,
    release_year: input.releaseYear ?? null,
    bottle_price: input.bottlePrice,
    bottle_ml: input.bottleMl,
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
  // so it starts hidden however the form's checkbox was left. One that already
  // carries uploaded gallery images publishes on the admin's word.
  const startsActive =
    aiMode && hostedImages.length === 0 ? false : input.isActive;

  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({
      ...base,
      scent_families: families,
      seasons: input.seasons,
      is_active: startsActive,
      is_featured: input.isFeatured,
      reference_image_url: referenceImageUrl,
    })
    .select("id")
    .single();

  if (pErr || !product) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }
  const productId = (product as { id: string }).id;

  // Variants: the admin priced each size by hand, so store the figure as-is.
  // `sale_price` нь тухайн хэмжээний бодит хямдрал (0054) — хоосон бол null.
  const variants = input.variants.map((v) => ({
    product_id: productId,
    ml: v.ml,
    price: v.price,
    sale_price: v.salePrice && v.salePrice > 0 ? v.salePrice : null,
    is_active: v.active,
  }));

  await supabase.from("product_variants").insert(variants);

  // Gallery images are the gallery, always — the AI reference is a separate
  // field now, so the two no longer compete for the same uploads.
  if (hostedImages.length) {
    await supabase.from("product_images").insert(
      hostedImages.map((img, i) => ({
        product_id: productId,
        url: img.url,
        alt: img.alt || input.name,
        sort_order: i,
        is_visible: img.visible,
      })),
    );
  }

  if (aiMode) {
    // Two pictures from the one uploaded bottle: the catalogue packshot, then
    // the note image shot from that packshot (lib/ai/new-product-pipeline.ts).
    // Runs after the response is sent — the admin lands on the table while the
    // images generate; the table polls until they're done (§6.3).
    after(async () => {
      await runNewProductImages(productId, referenceImageUrl!);
    });
  }

  await supabase.from("inventory").insert({
    product_id: productId,
    on_hand_ml: input.onHandMl,
    low_stock_ml: input.lowStockMl,
  });

  // Tags (new / hot / sale) straight from the create form — previously these
  // could only be set by editing the product afterwards.
  if (input.tags.length) {
    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, slug")
      .in("slug", input.tags);
    const links = ((tagRows as { id: string }[] | null) ?? []).map((t) => ({
      product_id: productId,
      tag_id: t.id,
    }));
    if (links.length) await supabase.from("product_tags").insert(links);
  }

  // Free-form internal tags (search / quiz pool, A2 «Нэмэлт Tag»).
  const customTags = await sanitizeCustomTags(input.customTags);
  if (customTags.length) {
    const { data: ctRows } = await supabase
      .from("custom_tags")
      .select("id, slug")
      .in("slug", customTags);
    const links = ((ctRows as { id: string }[] | null) ?? []).map((t) => ({
      product_id: productId,
      tag_id: t.id,
    }));
    if (links.length) await supabase.from("product_custom_tags").insert(links);
  }

  revalidatePublic();
  return NextResponse.json({ ok: true, id: productId, slug });
}
