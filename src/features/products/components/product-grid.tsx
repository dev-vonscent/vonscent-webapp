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
  eagerCount = 0,
}: {
  products?: ProductListItem[];
  items?: RailItem[];
  /** Харж буй жагсаалтын төлөв card дээр түрүүлнэ (`cardStatus`). */
  prefer?: CardStatus[];
  /** Эхний N нүдний зургийг lazy биш татна (эхний дэлгэцний LCP). */
  eagerCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {items
        ? items.map((it, i) =>
            it.kind === "product" ? (
              <ProductCard
                key={`product-${it.product.id}`}
                product={it.product}
                eager={i < eagerCount}
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
        : products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              prefer={prefer}
              eager={i < eagerCount}
            />
          ))}
    </div>
  );
}
