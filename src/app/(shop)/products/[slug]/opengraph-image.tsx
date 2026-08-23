import { ogCard, OG_SIZE } from "@/lib/og";
import { getProductBySlug } from "@/features/products/api";
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
  const product = await getProductBySlug(slug);
  if (!product) return ogCard({ title: SITE.tagline });

  return ogCard({
    kicker: product.brand,
    title: product.name,
    subtitle: product.soldOut
      ? "Дууссан"
      : `${formatPrice(product.startingPrice)}-с эхэлнэ`,
    imageUrl: product.image?.url ?? null,
    badge: product.salePct ? `-${product.salePct}%` : undefined,
  });
}
