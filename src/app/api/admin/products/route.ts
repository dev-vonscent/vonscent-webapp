import { NextResponse, after } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { productInputSchema } from "@/lib/validators/product";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { isStorageUrl } from "@/lib/storage/storage";
import { resolveBrandId, sanitizeCustomTags, sanitizeFamilies } from "@/features/taxonomy/api";
import {
  buildImagePrompt,
  DEFAULT_BASE_PROMPT,
} from "@/lib/ai/build-image-prompt";
import { processGeneration } from "@/lib/ai/process-generation";

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
    sale_pct: input.salePct,
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
  const startsActive = aiMode && hostedImages.length === 0 ? false : input.isActive;

  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({
      ...base,
      scent_families: families,
      seasons: input.seasons,
      is_active: startsActive,
      reference_image_url: referenceImageUrl,
    })
    .select("id")
    .single();

  if (pErr || !product) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }
  const productId = (product as { id: string }).id;

  // Variants: the admin priced each size by hand, so store the figure as-is.
  const variants = input.variants.map((v) => ({
    product_id: productId,
    ml: v.ml,
    price: v.price,
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
    // Compose the prompt from the current base prompt in build-image-prompt.ts
    // (the file is the single source of truth), then enqueue + kick off the job.
    const prompt = buildImagePrompt(
      {
        name: input.name,
        brand: input.brand,
        gender: input.gender,
        scentFamilies: families,
        shortDescription: input.shortDescription,
        description: input.description,
      },
      DEFAULT_BASE_PROMPT,
    );

    const { data: job } = await supabase
      .from("product_image_generations")
      .insert({
        product_id: productId,
        status: "pending",
        prompt,
        reference_url: referenceImageUrl,
      })
      .select("id")
      .single();

    if (job) {
      const jobId = (job as { id: string }).id;
      // Runs after the response is sent — the admin lands on the table while
      // the image generates; the table polls until it's done (§6.3).
      after(async () => {
        await processGeneration(jobId);
      });
    }
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
