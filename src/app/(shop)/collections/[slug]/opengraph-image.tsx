import { coverOgCard, OG_SIZE } from "@/lib/og";
import { getCollectionBySlug } from "@/features/collections/api";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/lib/constants";
import { formatDiscountRange } from "@/features/collections/pricing";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SITE.brandName;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return coverOgCard({ imageUrl: null });

  return coverOgCard({
    imageUrl: collection.image,
    line: collection.soldOut
      ? "Дууссан"
      : `${formatPrice(collection.startingPrice)}-с`,
    badge:
      !collection.soldOut && collection.discountRange.max
        ? `−${formatDiscountRange(collection.discountRange)}`
        : undefined,
  });
}
