import { ProductCard } from "./product-card";
import { CollectionCard } from "@/features/collections/components/collection-card";
import type { ProductListItem } from "@/lib/types";
import type { RailItem } from "../rail";
import type { CardStatus } from "../card-status";

/** `items` өгвөл ус, багц холилдсон grid; эс бөгөөс зөвхөн `products`. */
export function ProductGrid({
  products = [],
  items,
  prefer,
}: {
  products?: ProductListItem[];
  items?: RailItem[];
  /** Харж буй жагсаалтын төлөв card дээр түрүүлнэ (`cardStatus`). */
  prefer?: CardStatus[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {items
        ? items.map((it) =>
            it.kind === "product" ? (
              <ProductCard
                key={`product-${it.product.id}`}
                product={it.product}
                prefer={prefer}
              />
            ) : (
              <CollectionCard
                key={`collection-${it.collection.id}`}
                collection={it.collection}
                variant="rail"
                prefer={prefer}
              />
            ),
          )
        : products.map((p) => (
            <ProductCard key={p.id} product={p} prefer={prefer} />
          ))}
    </div>
  );
}
