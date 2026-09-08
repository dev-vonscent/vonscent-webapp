"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { trackAddToCart, trackBeginCheckout } from "@/lib/analytics";
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
  const router = useRouter();

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
  // Хямдрал нь хэмжээ тус бүрийнх, бас БОДИТ (0054): `price` нь төлөх дүн,
  // `basePrice` нь зураастай харагдах үндсэн үнэ. Хувь харуулахгүй (B4).
  const basePrice = selected?.basePrice ?? 0;
  const originalPrice = basePrice > unitPrice ? basePrice : null;
  const soldOut = product.soldOut;
  // The whole product may still be sellable while this particular size is not.
  const selectedOut = !soldOut && selected != null && !selected.inStock;
  // Lowest ₮/ml among in-stock sizes gets the «Хамгийн ашигтай» badge.
  const buyDisabled = soldOut || !selected || !selected.inStock;
  const inStockVariants = activeVariants.filter((v) => v.inStock);
  const bestValue =
    inStockVariants.length > 1
      ? inStockVariants.reduce((a, b) =>
          a.price / a.ml <= b.price / b.ml ? a : b,
        )
      : null;

  /** Puts the selected size in the cart. Returns false when nothing was added. */
  function addToCart(): boolean {
    if (!selected || soldOut || !selected.inStock) return false;
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
    return true;
  }

  function onAdd() {
    if (!addToCart()) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  /**
   * «Захиалах» — the same add, then straight to checkout.
   *
   * It goes through the cart rather than around it: checkout prices the whole
   * cart server-side, and a parallel "just this one item" path would be a
   * second pricing route to keep in step with coupons, bundles, gifts and
   * loyalty. Anything already in the cart therefore comes along, which is what
   * a customer who has been adding items expects — and the checkout page is
   * where they can still change it.
   */
  function onBuyNow() {
    if (!addToCart()) return;
    if (selected) {
      trackBeginCheckout(
        [
          {
            id: product.id,
            name: `${product.name} ${selected.ml}ml`,
            brand: product.brand,
            price: unitPrice,
            quantity: qty,
          },
        ],
        unitPrice * qty,
      );
    }
    router.push("/checkout");
  }

  return (
    <div className="space-y-6">
      {/* Live price — updates with ml selection (requirement.md §3) */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="font-serif text-3xl font-semibold">
          {formatPrice(unitPrice)}
        </span>
        {originalPrice && originalPrice > unitPrice && (
          <span className="text-muted-foreground pb-1 text-base line-through">
            {formatPrice(originalPrice)}
          </span>
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
                aria-pressed={v.inStock ? active : undefined}
                aria-label={v.inStock ? `${v.ml}ml` : `${v.ml}ml — дууссан`}
                className={cn(
                  "relative flex min-h-11 min-w-20 flex-col items-center justify-center rounded-lg px-4 py-2 transition-colors",
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
                {v.inStock && v.basePrice > v.price && (
                  <span className="text-muted-foreground text-[10px] line-through">
                    {formatPrice(v.basePrice)}
                  </span>
                )}
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

      <div ref={ctaRef} className="space-y-3">
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

          {/* «Захиалах» leads: it is the shorter road to a paid order, and
              the cart stays one tap away underneath. */}
          <Button
            size="lg"
            className="flex-1 in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
            disabled={buyDisabled}
            onClick={onBuyNow}
          >
            {soldOut
              ? "Дууссан"
              : selectedOut
                ? `${selected?.ml}ml дууссан`
                : "Захиалах"}
          </Button>
        </div>

        <Button
          size="lg"
          variant="outline"
          className="w-full"
          disabled={buyDisabled}
          onClick={onAdd}
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
            <p className="font-serif text-lg/tight font-semibold">
              {formatPrice(unitPrice)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Icon-only at this width — the label would push «Захиалах» off
                the bar on a small phone. */}
            <Button
              variant="outline"
              size="icon"
              onClick={onAdd}
              aria-label="Сагсанд нэмэх"
            >
              {added ? (
                <Check className="size-4" />
              ) : (
                <ShoppingCart className="size-4" />
              )}
            </Button>
            <Button
              onClick={onBuyNow}
              className="in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
            >
              Захиалах
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
