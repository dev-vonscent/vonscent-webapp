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
import { cartMlFor } from "@/features/cart/budget";
import { maxUnits } from "@/features/products/sellable";
import { trackAddToCart, trackBeginCheckout } from "@/lib/analytics";
import type { ProductDetail } from "@/lib/types";

export function ProductPurchase({ product }: { product: ProductDetail }) {
  // Худалдаж болох хэмжээнүүд — сонголт, «хамгийн ашигтай», үнийн тооцоо
  // бүгд эднээс уншина.
  const activeVariants = product.variants.filter((v) => v.isActive);
  // Preselect the cheapest size that is actually in stock, so the headline
  // price is one the customer can buy (requirement_fb.md §"ml-ийн үнэ").
  const [variantId, setVariantId] = React.useState(
    (activeVariants.find((v) => v.sellable) ?? activeVariants[0])?.id ?? "",
  );
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const add = useCart((s) => s.add);
  const startBuyNow = useCart((s) => s.startBuyNow);
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

  // Сагсанд ЭНЭ бараанаас аль хэдийн орсон ml. `sellable` нь «нэг ширхэг
  // цутгах ml хүрэлцэх үү» гэсэн асуулт тул түүнд найдвал 15ml үлдэгдэлтэй
  // бараанаас 10ml×2 (эсвэл 10ml + 5ml) сагсанд орчихдог байв.
  const cartItems = useCart((s) => s.items);
  const cartCollections = useCart((s) => s.collections);

  const selected = activeVariants.find((v) => v.id === variantId) ?? null;
  const unitPrice = selected?.price ?? 0;
  // Хямдрал нь хэмжээ тус бүрийнх, бас БОДИТ (0054): `price` нь төлөх дүн,
  // `basePrice` нь зураастай харагдах үндсэн үнэ. Хувь харуулахгүй (B4).
  const basePrice = selected?.basePrice ?? 0;
  const originalPrice = basePrice > unitPrice ? basePrice : null;
  const soldOut = product.soldOut;
  // The whole product may still be sellable while this particular size is not.
  const selectedOut = !soldOut && selected != null && !selected.sellable;
  // Савны түгжээ (0095) нь түр зуурынх — «дууссан» гэхээс өөр үг хэрэгтэй.
  const selectedBottleLocked =
    selected != null && selected.unavailableReason === "bottle";
  // Lowest ₮/ml among in-stock sizes gets the «Хамгийн ашигтай» badge.
  /** Энэ хэмжээгээр өнөөдөр авч болох ДЭЭД тоо ширхэг. */
  const maxQty = maxUnits({
    ml: selected?.ml ?? 0,
    sellable: selected?.sellable ?? false,
    remainingMl:
      product.availableMl -
      cartMlFor(product.id, { items: cartItems, collections: cartCollections }),
  });
  const buyDisabled = soldOut || !selected || !selected.sellable || maxQty < 1;
  // Хэмжээ солиход (20ml → 2ml) эсвэл сагс өөрчлөгдөхөд сонгосон тоо ширхэг
  // үлдэгдэлд багтахаа болих боломжтой — тэр дороо буулгана.
  React.useEffect(() => {
    setQty((q) => (maxQty >= 1 ? Math.min(q, maxQty) : 1));
  }, [maxQty]);
  const inStockVariants = activeVariants.filter((v) => v.sellable);
  const bestValue =
    inStockVariants.length > 1
      ? inStockVariants.reduce((a, b) =>
          a.price / a.ml <= b.price / b.ml ? a : b,
        )
      : null;

  // Зурвас гарах цорын ганц нөхцөл — доод цэсэнд мэдэгдэх нэхэмжлэл ч үүнээс
  // уншина, ингэснээр хоёулаа хэзээ ч зөрөхгүй.
  const showBuyBar =
    ctaAway &&
    !atRelated &&
    !soldOut &&
    selected != null &&
    selected.sellable &&
    maxQty >= 1;
  useClaimBottomBar(showBuyBar);

  /**
   * Puts the selected size in the cart. Returns false when nothing was added.
   *
   * `mode: "buy-now"` нь «Захиалах»-ын зам: сагсанд огт хүрэлгүй, зөвхөн
   * төлбөрийн хуудсанд явах тусдаа мөр болгоно (store.ts `startBuyNow`).
   */
  function addToCart(mode: "add" | "buy-now" = "add"): boolean {
    if (!selected || soldOut || !selected.sellable || maxQty < 1) return false;
    const line = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      variantId: selected.id,
      ml: selected.ml,
      unitPrice,
      image: product.image?.url ?? null,
    };
    if (mode === "buy-now") startBuyNow(line, qty);
    else add(line, qty);
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
   * It goes *around* the cart, the way a Buy Now button is understood
   * everywhere else: the line never lands in `items`, so the cart is exactly
   * as the customer left it if they back out, pressing it twice orders one and
   * not two, and whatever was already in the cart is not quietly charged for.
   * Checkout still prices it server-side through the one shared route — only
   * the basket it is handed differs.
   */
  function onBuyNow() {
    if (!addToCart("buy-now")) return;
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
        {/*
          Хэмжээ бүр ХАРАГДАНА — «Зарна»-г авсан нь жагсаалтаас алга болдог
          байлаа. Тэгэхээр 5ml-г түр хаасан бараа 2 / 10 / 20 гэсэн цоорхойтой
          эгнээ үзүүлээд, худалдан авагч тэр хэмжээ огт байдаггүй гэж ойлгодог
          байв. Одоо гурван төлөв тодорхой:
            · зарагдаж буй  — сонгоно
            · түр дууссан   — идэвхгүй, зураастай, «Дууссан» (үлдэгдэл дуусахад)
            · зарахгүй      — идэвхгүй, «Зарахгүй» (админ өөрөө хаасан)
          Зарахгүй хэмжээн дээр үнэ ХАРУУЛАХГҮЙ: зарахгүй зүйлийн үнэ нь
          худалдан авах боломжтой мэт ойлголт өгнө.
        */}
        <div className="flex flex-wrap gap-2">
          {product.variants.map((v) => {
            const active = v.id === variantId;
            const isBestValue = bestValue != null && v.id === bestValue.id;
            const sellable = v.sellable;
            // Савны түгжээ нь «бидэнд энэ өнгийн сав дууслаа» гэсэн ТҮР зуурын
            // төлөв — үлдэгдэл дуусахаас өөр үг хэрэглэнэ, ингэснээр
            // хэрэглэгч эргэж ирэхээ мэднэ.
            const bottle = v.unavailableReason === "bottle";
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                disabled={!sellable}
                aria-pressed={sellable ? active : undefined}
                aria-label={
                  sellable
                    ? `${v.ml}ml`
                    : bottle
                      ? `${v.ml}ml — түр байхгүй`
                      : v.isActive
                        ? `${v.ml}ml — дууссан`
                        : `${v.ml}ml — зарахгүй`
                }
                className={cn(
                  "relative flex min-h-11 min-w-20 flex-col items-center justify-center rounded-lg px-4 py-2 transition-colors",
                  !v.isActive
                    ? "bg-secondary/40 text-muted-foreground cursor-not-allowed opacity-60"
                    : !sellable
                      ? "bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-50"
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
                {/* Зураас зөвхөн хэмжээн дээр: доорх «Дууссан» / «Түр
                    байхгүй» / «Зарахгүй» гэсэн үгийг зурвал уншигдахгүй. */}
                <span
                  className={cn(
                    "text-sm font-semibold",
                    !sellable && "line-through",
                  )}
                >
                  {v.ml}ml
                </span>
                <span className="text-muted-foreground text-xs">
                  {!v.isActive
                    ? "Зарахгүй"
                    : bottle
                      ? "Түр байхгүй"
                      : v.inStock
                        ? formatPrice(v.price)
                        : "Дууссан"}
                </span>
                {sellable && v.basePrice > v.price && (
                  <span className="text-muted-foreground text-[10px] line-through">
                    {formatPrice(v.basePrice)}
                  </span>
                )}
                {sellable && (
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
            {selectedBottleLocked
              ? "Энэ хэмжээний сав түр дууссан байна. Өөр хэмжээ сонгоно уу."
              : "Энэ хэмжээ түр дууссан байна. Өөр хэмжээ сонгоно уу."}
          </p>
        )}
        {/* Хэмжээ зарагдаж байгаа ч эх савны үлдэгдэл цөөхөн ширхэг л
            гүйцээнэ — тоо ширхэгийн товч дээр мөргөхөөс нь өмнө хэлнэ.
            4-өөс дээш бол дэмий сандаргахгүй. */}
        {!soldOut && selected?.sellable && maxQty < 1 && (
          <p className="text-muted-foreground text-xs">
            Энэ барааны үлдэгдэл сагсанд чинь бүрэн орсон байна.
          </p>
        )}
        {!soldOut && selected?.sellable && maxQty >= 1 && maxQty <= 3 && (
          <p className="text-muted-foreground text-xs">
            Үлдэгдэл хомс — {selected.ml}ml-ээс {maxQty} ш авах боломжтой.
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
              className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground flex h-full w-11 items-center justify-center rounded-r-md transition-colors disabled:opacity-40"
              onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
              disabled={qty >= maxQty}
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
          Нөөцөд бэлэн · Улаанбаатарт маргааш хүргэх боломжтой
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
