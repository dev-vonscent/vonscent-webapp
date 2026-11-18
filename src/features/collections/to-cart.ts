import type { CartCollection } from "@/features/cart/store";
import type { CollectionCardData, CollectionPriceAtMl } from "./types";
import { memberUnitPrice } from "./pricing";

/**
 * Багцыг нэг хэмжээгээр сагсны мөр болгоно — багцын хуудас ба нүүрний
 * хурдан нэмэх цонх хоёулаа үүнийг ашиглана, сагсанд ижил мөр очно.
 */
export function toCartCollection(
  collection: CollectionCardData,
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
        // Багц үндсэн үнээр бодогддог тул «хэмнэлт» (гишүүдийн нийлбэр −
        // багцын үнэ) ч үндсэн үнээс (plan §5.3, task 8.2).
        price: memberUnitPrice(v),
      };
    }),
    unitPrice: priceRow.price,
    // 16.7: LIVE арга хэмжээний хэсэг — задаргааны «<Event нэр>» мөр.
    ...(priceRow.eventSaving && collection.event
      ? { saleLabel: collection.event.name, saleAmount: priceRow.eventSaving }
      : {}),
  };
}
