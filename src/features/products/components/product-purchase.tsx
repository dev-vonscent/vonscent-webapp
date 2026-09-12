"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { RELATED_SECTION_ID } from "@/lib/constants";
import { useClaimBottomBar } from "@/components/shared/bottom-nav-store";
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

  // …and stands down again over «Төстэй бараа». At the bottom of the page the
  // bar was parked on top of the last row of *other* products' cards — their
  // wishlist and quick-add buttons became untappable, and a «Захиалах» for this
  // perfume sitting over a different one is misleading on top of being in the
  // way. The section is absent when the product has no related items, in which
  // case there is nothing to collide with and the bar simply stays.
  const [atRelated, setAtRelated] = React.useState(false);
  React.useEffect(() => {
    const el = document.getElementById(RELATED_SECTION_ID);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtRelated(entry.isIntersecting),
      // Positive bottom margin: the section counts as "here" while it is still
      // just below the fold, so the bar is already gone by the time the first
      // card is reachable rather than lifting off from under the thumb.
      { rootMargin: "0px 0px 120px 0px" },
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

  // Зурвас гарах цорын ганц нөхцөл — доод цэсэнд мэдэгдэх нэхэмжлэл ч үүнээс
  // уншина, ингэснээр хоёулаа хэзээ ч зөрөхгүй.
  const showBuyBar =
    ctaAway && !atRelated && !soldOut && selected != null && selected.inStock;
  useClaimBottomBar(showBuyBar);

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
          {/* Stepper height is locked to the lg button next to it (h-12) so the
              row reads as one control strip. */}
          <div className="bg-secondary flex h-12 shrink-0 items-center rounded-md">
            <button
              className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground flex h-full w-11 items-center justify-center rounded-l-md transition-colors disabled:opacity-40"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Хасах"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {qty}
            </span>
            <button
              className="text-muted-foreground hover:text-foreground flex h-full w-11 items-center justify-center rounded-r-md transition-colors"
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

        {/* `outline` has no surface in this borderless system — the secondary
            layer is what gives a full-width button its own ground. */}
        <Button
          size="lg"
          variant="secondary"
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

        {/* Дээрх том үнэ нь нэгжийн үнэ хэвээр үлдэнэ — тэр нь «/ Nml» ба
            ₮/ml харьцуулалттай холбоотой лавлах дүн. Тоо ширхэг 1-ээс олон
            болсон үед төлөх дүнг энд, дарах мөчид нь харуулна (сагс,
            төлбөрийн хуудасны мөр ч ижил `unitPrice × qty` уншина). */}
        {qty > 1 && !buyDisabled && (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {qty} ш × {formatPrice(unitPrice)} ={" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatPrice(unitPrice * qty)}
            </span>
          </p>
        )}
      </div>

      {/* Availability + delivery promise right where the buying decision
          happens (Baymard: reassure before the add-to-cart, not after). */}
      {!soldOut && selected?.inStock && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Check className="text-success size-3.5" />
          Нөөцөд бэлэн · Улаанбаатарт хамгийн эрт нь маргааш хүргэгдэнэ
        </p>
      )}

      {/* Mobile sticky buy bar. It takes the BottomNav's place rather than
          stacking on it (`useClaimBottomBar`), so it also takes its shape: a
          floating capsule with the Glass Trio (/85 + blur + lift), inset from
          the edge. Flush against the bottom it read as stuck to the screen
          instead of hovering over the page. */}
      {showBuyBar && (
        <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden">
          <div className="bg-secondary/85 shadow-lift pointer-events-auto mb-3 flex w-full items-center gap-3 rounded-full py-2 pr-2 pl-4 backdrop-blur">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[11px]">
                {product.name} · {selected.ml}ml
                {qty > 1 && ` · ${qty} ш`}
              </p>
              <p className="font-serif text-base/tight font-semibold tabular-nums">
                {formatPrice(unitPrice * qty)}
              </p>
            </div>
            {/* Icon-only at this width — the label would push «Захиалах» off
                the bar on a small phone. Both pills, to nest in the capsule. */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
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
              className="shrink-0 rounded-full in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
            >
              Захиалах
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
