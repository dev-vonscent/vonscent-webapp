import type { ProductDetail } from "@/lib/types";
import type { AdminProduct } from "@/features/admin/components/collection-form";

/**
 * Trim the catalogue down to what the bundle picker needs.
 *
 * The price table is the reason the variants come along: a bundle's price is
 * derived from its members', so the form cannot show what a size costs — or
 * whether it can be sold at all — without each perfume's price per ml. Only
 * active variants are carried; an inactive size is not one the bundle may use.
 */
export function toAdminProducts(products: ProductDetail[]): AdminProduct[] {
  return products.map((p) => {
    const priceByMl: Record<number, number> = {};
    for (const v of p.variants) {
      if (v.isActive) priceByMl[v.ml] = v.price;
    }
    return { id: p.id, name: p.name, brand: p.brand, priceByMl };
  });
}
