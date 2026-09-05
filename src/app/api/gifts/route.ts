import { NextResponse } from "next/server";
import { fetchProducts } from "@/features/products/api";
import { getGiftSettings } from "@/features/content/api";
import { GIFT_SAMPLE_ML, GIFT_THRESHOLD } from "@/lib/constants";

/**
 * Бэлгийн санд буй уснууд — сагс, checkout хоёулаа эндээс уншина (backlog A2).
 * Зөвхөн бодитоор байгаа, нийтлэгдсэн, 1мл-ээ гаргах үлдэгдэлтэй нь буцна.
 */
export async function GET() {
  const settings = await getGiftSettings();
  if (!settings.enabled || settings.productIds.length === 0) {
    return NextResponse.json({ enabled: false, threshold: GIFT_THRESHOLD, products: [] });
  }

  const all = await fetchProducts();
  const pool = new Set(settings.productIds);
  const products = all
    .filter(
      (p) => pool.has(p.id) && !p.soldOut && p.availableMl >= GIFT_SAMPLE_ML,
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      image: p.images[0]?.url ?? null,
    }));

  return NextResponse.json({
    enabled: true,
    threshold: GIFT_THRESHOLD,
    sampleMl: GIFT_SAMPLE_ML,
    products,
  });
}
