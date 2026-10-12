import { ogCard, OG_SIZE } from "@/lib/og";
import { getProductPageBySlug } from "@/features/products/api";
import { formatPrice } from "@/lib/format";
import { SITE } from "@/lib/constants";

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
  // Барааны хуудастай ижил — «Тун удахгүй» ус (0125) ч хуваалцагдана.
  const product = await getProductPageBySlug(slug);
  if (!product) return ogCard({ title: SITE.tagline });

  return ogCard({
    kicker: product.brand,
    title: product.name,
    // «Тун удахгүй» ус бас `soldOut` — гэхдээ дууссан биш, үнэ нь мэдэгдэнэ.
    subtitle:
      product.soldOut && !product.comingSoon
        ? "Дууссан"
        : `${formatPrice(product.startingPrice)}-с эхэлнэ`,
    imageUrl: product.image?.url ?? null,
    // Хувь харуулахгүй (backlog B4) — хямдралтай эсэхийг л дохино.
    badge: product.comingSoon
      ? "Тун удахгүй"
      : product.startingBasePrice > product.startingPrice
        ? "Хямдрал"
        : undefined,
  });
}
