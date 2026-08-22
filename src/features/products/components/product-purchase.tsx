"use client";

import * as React from "react";
import { Minus, Plus, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { trackAddToCart } from "@/lib/analytics";
import type { ProductDetail } from "@/lib/types";

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const activeVariants = product.variants.filter((v) => v.isActive);
  // Preselect the cheapest size that is actually in stock, so the headline
  // price is one the customer can buy (requirement_fb.md §"ml-ийн үнэ").
  const [variantId, setVariantId] = React.useState(
    (activeVariants.find((v) => v.inStock) ?? activeVariants[0])?.id ?? "",
  );
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const add = useCart((s) => s.add);

  const selected = activeVariants.find((v) => v.id === variantId) ?? null;
  const unitPrice = selected?.price ?? 0;
  const soldOut = product.soldOut;
  // The whole product may still be sellable while this particular size is not.
  const selectedOut = !soldOut && selected != null && !selected.inStock;

  function onAdd() {
    if (!selected || soldOut || !selected.inStock) return;
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        variantId: selected.id,
        ml: selected.ml,
        unitPrice,
        image: product.image?.url ?? null,
      },
      qty,
    );
    trackAddToCart({
      id: product.id,
      name: `${product.name} ${selected.ml}ml`,
      brand: product.brand,
      price: unitPrice,
      quantity: qty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Live price — updates with ml selection (requirement.md §3) */}
      <div className="flex items-end gap-3">
        <span className="font-serif text-3xl font-semibold">
          {formatPrice(unitPrice)}
        </span>
        {selected && (
          <span className="text-muted-foreground pb-1 text-sm">
            / {selected.ml}ml
          </span>
        )}
      </div>

      {product.description && (
        <p className="text-foreground/80 text-sm leading-relaxed">
          {product.description}
        </p>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium">Хэмжээ сонгох</p>
        <div className="flex flex-wrap gap-2">
          {activeVariants.map((v) => {
            const active = v.id === variantId;
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                disabled={!v.inStock}
                aria-label={v.inStock ? `${v.ml}ml` : `${v.ml}ml — дууссан`}
                className={cn(
                  "flex min-w-20 flex-col items-center rounded-lg px-4 py-2 transition-colors",
                  !v.inStock
                    ? "bg-secondary/50 text-muted-foreground cursor-not-allowed line-through opacity-50"
                    : active
                      ? "bg-foreground/30"
                      : "bg-secondary hover:bg-accent",
                )}
              >
                <span className="text-sm font-semibold">{v.ml}ml</span>
                <span className="text-muted-foreground text-xs">
                  {v.inStock ? formatPrice(v.price) : "Дууссан"}
                </span>
              </button>
            );
          })}
        </div>
        {selectedOut && (
          <p className="text-muted-foreground text-xs">
            Энэ хэмжээ түр дууссан байна. Өөр хэмжээ сонгоно уу.
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="bg-secondary flex items-center rounded-md">
          <button
            className="hover:text-foreground px-3 py-2"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Хасах"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm">{qty}</span>
          <button
            className="hover:text-foreground px-3 py-2"
            onClick={() => setQty((q) => q + 1)}
            aria-label="Нэмэх"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <Button
          size="lg"
          className="flex-1 [.black_&]:bg-white [.black_&]:text-black [.black_&]:hover:bg-white/90"
          disabled={soldOut || !selected || !selected.inStock}
          onClick={onAdd}
        >
          {added ? (
            <>
              <Check className="size-4" /> Нэмэгдлээ
            </>
          ) : soldOut ? (
            "Дууссан"
          ) : selectedOut ? (
            `${selected?.ml}ml дууссан`
          ) : (
            <>
              <ShoppingCart className="size-4" /> Сагсанд нэмэх
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
