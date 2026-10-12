import type { CartItem } from "@/features/cart/store";
import type { ProductDetail, Variant } from "@/lib/types";

/**
 * «Бүгдийг сагслах»-д орох ус: одоо зарагдаж буй нь л. «Тун удахгүй» ус
 * (0125) нь `soldOut` боловч дууссан биш — ирэхийг хүлээж байгаа тул хүслийн
 * жагсаалтад тусад нь тоологдоно, сагсанд орохгүй.
 */
export function isAddable(p: ProductDetail): boolean {
  return !p.soldOut && !p.comingSoon;
}

/**
 * Хамгийн хямд ЗАРАГДАХ хэмжээ («-аас» үнэтэй ижил). Идэвхтэй ч дууссан,
 * савгүй хэмжээг сагсанд хийвэл checkout дээр л унана.
 */
export function cheapestVariant(p: ProductDetail): Variant | null {
  const sellable = p.variants.filter((v) => v.sellable);
  if (!sellable.length) return null;
  return sellable.reduce((a, b) => (b.price < a.price ? b : a));
}

/** «Бүгдийг сагслах»-ийн мөрүүд — ус бүрийн хамгийн хямд зарагдах хэмжээ. */
export function wishlistCartLines(
  items: ProductDetail[],
): Omit<CartItem, "key" | "qty">[] {
  return items.filter(isAddable).flatMap((p) => {
    const v = cheapestVariant(p);
    if (!v) return [];
    return [
      {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        variantId: v.id,
        ml: v.ml,
        unitPrice: v.price,
        image: p.image?.url ?? null,
      },
    ];
  });
}
