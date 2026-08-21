import { NextResponse, after } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { productInputSchema } from "@/lib/validators/product";
import { isSupabaseConfigured, isImageGenConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffUser } from "@/lib/auth/guard";
import { isStorageUrl } from "@/lib/storage/storage";
import { sanitizeFamilies } from "@/features/taxonomy/api";
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

  const base = {
    slug,
    name: input.name,
    brand: input.brand,
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

  // AI-generated images aren't published until the admin approves them (§5b),
  // so the product starts hidden. Uploaded images publish immediately.
  const aiMode = input.imageMode === "generate" && isImageGenConfigured;

  const { data: product, error: pErr } = await supabase
    .from("products")
    .insert({
      ...base,
      scent_families: families,
      seasons: input.seasons,
      is_active: !aiMode,
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

  const hostedImages = input.images.filter((img) => isStorageUrl(img.url));

  if (aiMode) {
    // The uploaded image is the AI *reference*, not the gallery. Enqueue a job
    // with the composed English prompt and kick it off in the background.
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "imageGen")
      .maybeSingle();
    const cfg = (setting?.value as { basePrompt?: string } | null) ?? {};

    const prompt = buildImagePrompt(
      {
        name: input.name,
        brand: input.brand,
        gender: input.gender,
        shortDescription: input.shortDescription,
        description: input.description,
      },
      cfg.basePrompt || DEFAULT_BASE_PROMPT,
    );

    const { data: job } = await supabase
      .from("product_image_generations")
      .insert({
        product_id: productId,
        status: "pending",
        prompt,
        reference_url: hostedImages[0]?.url ?? null,
      })
      .select("id")
      .single();

    if (job) {
      const jobId = (job as { id: string }).id;
      // Runs after the response is sent — the admin lands on the table while the
      // image generates; the table polls until it's done (§6.3).
      after(async () => {
        await processGeneration(jobId);
      });
    }
  } else if (hostedImages.length) {
    // Upload mode: the images are the gallery.
    await supabase.from("product_images").insert(
      hostedImages.map((img, i) => ({
        product_id: productId,
        url: img.url,
        alt: img.alt || input.name,
        sort_order: i,
      })),
    );
  }

  await supabase.from("inventory").insert({
    product_id: productId,
    on_hand_ml: input.onHandMl,
    low_stock_ml: input.lowStockMl,
  });

  revalidatePublic();
  return NextResponse.json({ ok: true, id: productId, slug });
}
