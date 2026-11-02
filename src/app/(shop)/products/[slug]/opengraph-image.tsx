import { coverOgCard, productOgCard, OG_SIZE } from "@/lib/og";
import { getProductPageBySlug } from "@/features/products/api";
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
  if (!product) return coverOgCard({ imageUrl: null });

  // Админы хаасан хэмжээ дэлгүүрт харагддаггүй — энд ч мөн адил.
  const sizes = product.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.ml - b.ml)
    .map((v) => ({
      ml: v.ml,
      price: v.price,
      basePrice: v.basePrice > v.price ? v.basePrice : undefined,
      // «Тун удахгүй» үед үнэ нь мэдэгдэнэ — дууссан гэж бичихгүй.
      soldOut: !product.comingSoon && !v.sellable,
    }));

  return productOgCard({
    imageUrl: product.image?.url ?? null,
    sizes,
    // Хувь харуулахгүй (backlog B4) — хямдралтай эсэхийг л дохино.
    badge: product.comingSoon
      ? "Тун удахгүй"
      : product.soldOut
        ? "Дууссан"
        : sizes.some((s) => s.basePrice && !s.soldOut)
          ? "Хямдрал"
          : undefined,
  });
}
