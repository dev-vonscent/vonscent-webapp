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

  // Mobile sticky buy bar (1e): appears once the in-page CTA scrolls away.
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const [ctaAway, setCtaAway] = React.useState(false);
  React.useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setCtaAway(!entry.isIntersecting),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selected = activeVariants.find((v) => v.id === variantId) ?? null;
  const unitPrice = selected?.price ?? 0;
  // sale_pct is display-only: the charged price stays `price`, the crossed-out
  // "original" is derived from it, rounded to a clean 100₮ (0038).
  const salePct = product.salePct;
  const originalPrice =
    salePct > 0
      ? Math.round(unitPrice / (1 - salePct / 100) / 100) * 100
      : null;
  const soldOut = product.soldOut;
  // The whole product may still be sellable while this particular size is not.
  const selectedOut = !soldOut && selected != null && !selected.inStock;
  // Lowest ₮/ml among in-stock sizes gets the «Хамгийн ашигтай» badge.
  const inStockVariants = activeVariants.filter((v) => v.inStock);
  const bestValue =
    inStockVariants.length > 1
      ? inStockVariants.reduce((a, b) => (a.price / a.ml <= b.price / b.ml ? a : b))
      : null;

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
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="font-serif text-3xl font-semibold">
          {formatPrice(unitPrice)}
        </span>
        {originalPrice && originalPrice > unitPrice && (
          <>
            <span className="text-muted-foreground pb-1 text-base line-through">
              {formatPrice(originalPrice)}
            </span>
            <span className="bg-destructive/15 text-destructive mb-1 rounded-md px-2 py-0.5 text-xs font-semibold">
              -{salePct}%
            </span>
          </>
        )}
        {selected && (
          <span className="text-muted-foreground pb-1 text-sm">
            / {selected.ml}ml
          </span>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Хэмжээ сонгох</p>
        <div className="flex flex-wrap gap-2">
          {activeVariants.map((v) => {
            const active = v.id === variantId;
            const isBestValue = bestValue != null && v.id === bestValue.id;
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                disabled={!v.inStock}
                aria-label={v.inStock ? `${v.ml}ml` : `${v.ml}ml — дууссан`}
                className={cn(
                  "relative flex min-w-20 flex-col items-center rounded-lg px-4 py-2 transition-colors",
                  !v.inStock
                    ? "bg-secondary/50 text-muted-foreground cursor-not-allowed line-through opacity-50"
                    : active
                      ? "bg-secondary ring-foreground ring-2"
                      : "bg-secondary hover:bg-accent",
                )}
              >
                {isBestValue && (
                  <span className="bg-foreground text-background absolute -top-2 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap">
                    Хамгийн ашигтай
                  </span>
                )}
                <span className="text-sm font-semibold">{v.ml}ml</span>
                <span className="text-muted-foreground text-xs">
                  {v.inStock ? formatPrice(v.price) : "Дууссан"}
                </span>
                {v.inStock && (
                  <span className="text-muted-foreground text-[10px]">
                    {formatPrice(Math.round(v.price / v.ml))}/ml
                  </span>
                )}
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

      <div ref={ctaRef} className="flex items-center gap-4">
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

      {/* Availability + delivery promise right where the buying decision
          happens (Baymard: reassure before the add-to-cart, not after). */}
      {!soldOut && selected?.inStock && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Check className="text-success size-3.5" />
          Нөөцөд бэлэн · Улаанбаатарт 24 цагийн дотор хүргэнэ
        </p>
      )}

      {/* Mobile sticky buy bar — sits above the floating bottom nav. */}
      {ctaAway && !soldOut && selected?.inStock && (
        <div className="bg-card/95 border-border fixed inset-x-0 bottom-20 z-40 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur md:hidden">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">
              {product.name} · {selected.ml}ml
            </p>
            <p className="font-serif text-lg leading-tight font-semibold">
              {formatPrice(unitPrice)}
            </p>
          </div>
          <Button
            onClick={onAdd}
            className="[.black_&]:bg-white [.black_&]:text-black [.black_&]:hover:bg-white/90"
          >
            {added ? (
              <>
                <Check className="size-4" /> Нэмэгдлээ
              </>
            ) : (
              <>
                <ShoppingCart className="size-4" /> Сагсанд нэмэх
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
