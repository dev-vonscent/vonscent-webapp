import { ogCard, OG_SIZE } from "@/lib/og";
import { getCollectionBySlug } from "@/features/collections/api";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/lib/constants";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SITE.name;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return ogCard({ title: SITE.tagline });

  return ogCard({
    kicker: "Багц",
    title: collection.name,
    subtitle: collection.soldOut
      ? "Дууссан"
      : `${formatPrice(collection.startingPrice)}-с эхэлнэ`,
    imageUrl: collection.image,
    badge: collection.discountPct ? `-${collection.discountPct}%` : undefined,
  });
}
