import type { OgCardProps } from "@/lib/og";

type CardData = Omit<OgCardProps, "backdrop">;
import { getProductPageBySlug } from "@/features/products/api";
import { getCollectionBySlug } from "@/features/collections/api";
import { formatDiscountRange } from "@/features/collections/pricing";
import { formatPrice } from "@/lib/format";

/** Share-card data for a product page (null → not found). */
export async function productOgData(slug: string): Promise<CardData | null> {
  // Барааны хуудастай ижил — «Тун удахгүй» ус (0125) ч хуваалцагдана.
  const product = await getProductPageBySlug(slug);
  if (!product) return null;
  const mls = product.variants
    .filter((v) => v.isActive)
    .map((v) => v.ml)
    .sort((a, b) => a - b);
  return {
    kicker: product.brand,
    name: product.name,
    // «Тун удахгүй» ус бас `soldOut` — гэхдээ дууссан биш, үнэ нь мэдэгдэнэ.
    price:
      product.soldOut && !product.comingSoon
        ? "Дууссан"
        : `${formatPrice(product.startingPrice)}-с`,
    sizes: mls.length ? `${mls.join(" · ")} мл` : undefined,
    imageUrl: product.image?.url ?? null,
    // Хувь харуулахгүй (backlog B4) — хямдралтай эсэхийг л дохино.
    badge: product.comingSoon
      ? "Тун удахгүй"
      : !product.soldOut && product.startingBasePrice > product.startingPrice
        ? "Хямдрал"
        : undefined,
  };
}

/** Share-card data for a collection page (null → not found). */
export async function collectionOgData(slug: string): Promise<CardData | null> {
  const collection = await getCollectionBySlug(slug);
  if (!collection) return null;
  return {
    kicker: "Багц",
    name: collection.name,
    price: collection.soldOut
      ? "Дууссан"
      : `${formatPrice(collection.startingPrice)}-с`,
    badge:
      !collection.soldOut && collection.discountRange.max
        ? `−${formatDiscountRange(collection.discountRange)}`
        : undefined,
    imageUrl: collection.image,
  };
}
