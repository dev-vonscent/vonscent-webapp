/**
 * Seed the database with the demo catalogue.
 *
 *   pnpm db:seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env.
 */
import { createClient } from "@supabase/supabase-js";
import { SEED_RAW, productImageUrls } from "../src/features/products/seed";
import { ML_SIZES } from "../src/lib/constants";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

async function main() {
  // Map tag slugs to ids.
  const { data: tags } = await supabase.from("tags").select("id, slug");
  const tagId = new Map<string, string>(
    (tags ?? []).map((t: { id: string; slug: string }) => [t.slug, t.id]),
  );

  for (const p of SEED_RAW) {
    const { data: product, error } = await supabase
      .from("products")
      .upsert(
        {
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          description: p.description,
          notes_top: p.notesTop,
          notes_heart: p.notesHeart,
          notes_base: p.notesBase,
          gender: p.gender,
          concentration: p.concentration,
          scent_families: p.scentFamilies,
          seasons: p.seasons,
          origin_country: p.originCountry,
          release_year: p.releaseYear,
          bottle_price: p.bottlePrice,
          bottle_ml: p.bottleMl,
          rating_avg: p.ratingAvg,
          rating_count: p.ratingCount,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (error || !product) {
      console.error(`Failed: ${p.slug}`, error?.message);
      continue;
    }
    const id = (product as { id: string }).id;

    // Images (real perfume photos)
    await supabase.from("product_images").delete().eq("product_id", id);
    await supabase.from("product_images").insert(
      productImageUrls(p.slug).map((url, n) => ({
        product_id: id,
        url,
        alt: p.name,
        sort_order: n,
      })),
    );

    // Variants — the fixture's per-size prices, exactly as an admin would type
    // them in the product form.
    await supabase.from("product_variants").delete().eq("product_id", id);
    await supabase.from("product_variants").insert(
      ML_SIZES.filter((ml) => p.prices?.[ml] != null).map((ml) => ({
        product_id: id,
        ml,
        price: p.prices![ml]!,
        is_active: true,
      })),
    );

    // Inventory
    await supabase.from("inventory").upsert({
      product_id: id,
      on_hand_ml: p.onHandMl,
      low_stock_ml: 20,
      is_sold_out: p.onHandMl <= 0,
    });

    // Tags
    await supabase.from("product_tags").delete().eq("product_id", id);
    const links = p.tags
      .map((slug) => tagId.get(slug))
      .filter((v): v is string => Boolean(v))
      .map((tag_id) => ({ product_id: id, tag_id }));
    if (links.length) await supabase.from("product_tags").insert(links);

    console.log(`✓ ${p.brand} — ${p.name}`);
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
