import type { CartCollection } from "@/features/cart/store";
import type { Collection, CollectionPriceAtMl } from "./types";

/**
 * Багцыг нэг хэмжээгээр сагсны мөр болгоно — багцын хуудас ба нүүрний
 * хурдан нэмэх цонх хоёулаа үүнийг ашиглана, сагсанд ижил мөр очно.
 */
export function toCartCollection(
  collection: Collection,
  priceRow: CollectionPriceAtMl,
): Omit<CartCollection, "key" | "qty"> {
  const { ml } = priceRow;
  return {
    collectionId: collection.id,
    type: collection.type,
    slug: collection.slug,
    name: collection.name,
    image: collection.image,
    // The rate for the size being bought, not the bundle default: with
    // per-size discounts (0051) those differ, and the cart would otherwise
    // show a percentage the customer is not getting.
    discountPct: priceRow.discountPct,
    ml,
    members: collection.members.map((m) => {
      const v = m.variantByMl[ml];
      return {
        productId: m.productId,
        variantId: v.variantId,
        slug: m.slug,
        name: m.name,
        brand: m.brand,
        image: m.image?.url ?? null,
        price: v.price,
      };
    }),
    unitPrice: priceRow.price,
  };
}
