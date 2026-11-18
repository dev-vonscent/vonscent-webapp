"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  MobileBuyBar,
  useScrolledPast,
} from "@/components/shared/mobile-buy-bar";
import { useCart } from "@/features/cart/store";
import { useGiftPicks } from "@/features/extras/gift-picks";
import { cartMlFor } from "@/features/cart/budget";
import { maxUnits } from "@/features/products/sellable";
import {
  defaultSizeId,
  productSizeOptions,
} from "@/features/products/size-options";
import { SizeSelector } from "@/features/products/components/size-selector";
import { SizePrice } from "@/features/products/components/size-price";
import { AddToCartLabel } from "@/features/products/components/add-to-cart-label";
import { trackAddToCart } from "@/lib/analytics";
import type { ProductDetail } from "@/lib/types";

export function ProductPurchase({ product }: { product: ProductDetail }) {
  // Худалдаж болох хэмжээнүүд — сонголт, «хамгийн ашигтай», үнийн тооцоо
  // бүгд эднээс уншина.
  const activeVariants = product.variants.filter((v) => v.isActive);
  // Хэмжээний картууд (task 15) — бүх хэмжээ, «Зарахгүй» нь сонгогдохгүй.
  const sizeOptions = productSizeOptions(product.variants);
  // Зарагдаж буй хамгийн эхний (жижиг) хэмжээ — дууссан хэмжээ анхдагч
  // болохгүй (requirement_fb.md §"ml-ийн үнэ", task 4).
  const [variantId, setVariantId] = React.useState(() =>
    defaultSizeId(sizeOptions),
  );
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const add = useCart((s) => s.add);
  const startBuyNow = useCart((s) => s.startBuyNow);
  const addExtra = useCart((s) => s.addExtra);
  const router = useRouter();

  // Mobile sticky buy bar (1e): appears once the in-page CTA has been scrolled
  // *past* — above the viewport — not merely out of view. Утсан дээр зургийн
  // галерей эхэнд тул хуудас нээгдэх үед товч дэлгэцийн ДООР байдаг; «харагдахгүй
  // байна» гэсэн нөхцөл нь зурвасыг орох даруйд гаргаад, товч дээр ирэхэд
  // нууж, тоймын хэсэгт дахин халт гаргадаг байв. Одоо товчийг өнгөрсний дараа
  // л нэг удаа гарч, «Төстэй бараа» хүртэл тогтвортой үлдэнэ.
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const ctaAway = useScrolledPast(ctaRef);

  // «Төстэй бараа» дээр ирэхэд нуудаг байсныг авсан: товч ба тэр хэсгийн
  // хоорондох контент утасны дэлгэцээс богино (тайлбар цөөн, үнэлгээгүй)
  // бараан дээр зурвас хэдхэн зуун px-ийн цонхонд гялс гараад алга болж,
  // доод цэс ч хамт анивчдаг байв. Одоо товчийг өнгөрсний дараа хуудасны
  // төгсгөл хүртэл тогтвортой үлдэнэ; сүүлийн мөрийг layout-ын `pb-24`
  // (цэстэй ижил өндөр) чөлөөлнө.

  // Сагсанд ЭНЭ бараанаас аль хэдийн орсон ml. `sellable` нь «нэг ширхэг
  // цутгах ml хүрэлцэх үү» гэсэн асуулт тул түүнд найдвал 15ml үлдэгдэлтэй
  // бараанаас 10ml×2 (эсвэл 10ml + 5ml) сагсанд орчихдог байв.
  const cartItems = useCart((s) => s.items);
  const cartCollections = useCart((s) => s.collections);

  const selected = activeVariants.find((v) => v.id === variantId) ?? null;
  const unitPrice = selected?.price ?? 0;
  const soldOut = product.soldOut;
  // The whole product may still be sellable while this particular size is not.
  const selectedOut = !soldOut && selected != null && !selected.sellable;
  // Савны түгжээ (0095) нь түр зуурынх — «дууссан» гэхээс өөр үг хэрэгтэй.
  const selectedBottleLocked =
    selected != null && selected.unavailableReason === "bottle";
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

  // Зурвас гарах цорын ганц нөхцөл — доод цэсэнд мэдэгдэх нэхэмжлэл ч үүнээс
  // уншина, ингэснээр хоёулаа хэзээ ч зөрөхгүй.
  const showBuyBar =
    ctaAway && !soldOut && selected != null && selected.sellable && maxQty >= 1;

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
      basePrice: selected.basePrice,
      saleLabel: selected.saleLabel ?? null,
      image: product.image?.url ?? null,
    };
    // «Бэлэглэх бол»-д сонгосон боодол үнэртэнтэй хамт — аль ч замаар.
    const gifts = useGiftPicks.getState().picks;
    if (mode === "buy-now") startBuyNow(line, qty, gifts);
    else {
      add(line, qty);
      // Нэг захиалга — нэг боодол: сагсанд байвал тоо нь нэмэгдэхгүй (max 1).
      for (const g of gifts) addExtra(g, 1, 1);
    }
    trackAddToCart({
      id: product.id,
      name: `${product.name} ${selected.ml}ml`,
      brand: product.brand,
      price: unitPrice,
      quantity: qty,
    });
    return true;
  }

  /** Сонгосон хэмжээгээр нэмж авч болох тоо дууссан (сагсных ч тооцогдоно). */
  const atMaxQty = !buyDisabled && qty >= maxQty;

  function onIncrement() {
    if (buyDisabled) return;
    if (atMaxQty) {
      toast(
        `${selected?.ml}ml-ээс ${maxQty} ш л авах боломжтой.`,
        "Үлдэгдэл хомс",
      );
      return;
    }
    setQty((q) => Math.min(q + 1, maxQty));
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
    // InitiateCheckout-ыг энд БҮҮ явуул: checkout хуудас нээгдэхдээ buy-now
    // мөрийг оруулаад нэг удаа явуулдаг (`checkout/page.tsx`). Энд явуулбал
    // нэг худалдан авалт хоёр InitiateCheckout болж тоологддог байв.
    router.push("/checkout");
  }

  return (
    <div className="space-y-6">
      {/* Сонгосон хэмжээний үнэ — хэмжээ солиход дагана (task 15, 2.6).
          Дууссан хэмжээ сонгосон ч үнэ нь харагдана (task 4). */}
      <SizePrice
        price={unitPrice}
        basePrice={selected?.basePrice ?? 0}
        sizeLabel={selected ? `${selected.ml}ml` : null}
        endsAt={selected?.saleEndsAt}
      />

      <div className="space-y-3">
        {/*
          Хэмжээ бүр ХАРАГДАНА — «Зарна»-г авсан нь жагсаалтаас алга болдог
          байлаа (2 / 10 / 20 гэсэн цоорхойтой эгнээ). Төлөв:
            · зарагдаж буй  — «75 цацалт»
            · дууссан / сав түр байхгүй — СОНГОГДОНО, үнэ дээр харагдана,
              худалдан авах товч идэвхгүй (task 4)
            · зарахгүй      — сонгогдохгүй (админ өөрөө хаасан)
        */}
        <SizeSelector
          options={sizeOptions}
          value={variantId}
          onChange={setVariantId}
        />
        {selectedOut && (
          <p className="text-muted-foreground text-xs">
            {selectedBottleLocked
              ? "Энэ хэмжээний сав түр дууссан байна. Өөр хэмжээ сонгоно уу."
              : "Энэ хэмжээ түр дууссан байна. Өөр хэмжээ сонгоно уу."}
          </p>
        )}
        {!soldOut && selected?.sellable && maxQty < 1 && (
          <p className="text-muted-foreground text-xs">
            Энэ барааны үлдэгдэл сагсанд чинь бүрэн орсон байна.
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
              className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground data-limit:hover:text-muted-foreground flex h-full w-11 items-center justify-center rounded-r-md transition-colors disabled:opacity-40 data-limit:opacity-40"
              onClick={onIncrement}
              // Дээд тоондоо хүрсэн ч товч ИДЭВХТЭЙ: зүгээр л унтарсан «+» нь
              // яагаад гэдгийг хэлдэггүй байв — одоо дарахад «Үлдэгдэл хомс».
              disabled={buyDisabled}
              aria-disabled={atMaxQty || undefined}
              data-limit={atMaxQty || undefined}
              aria-label="Нэмэх"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* «Захиалах» leads: it is the shorter road to a paid order, and
              the cart stays one tap away underneath. */}
          <Button
            size="lg"
            className="bg-cta text-cta-foreground hover:bg-cta/90 flex-1"
            disabled={buyDisabled}
            onClick={onBuyNow}
          >
            {soldOut
              ? "Дууссан"
              : selectedOut
                ? selectedBottleLocked
                  ? "Түр байхгүй"
                  : "Дууссан"
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
          {/* Дээрх том үнэ нь нэгжийн үнэ; тоо ≥ 2 үед нийт дүн энд. */}
          <AddToCartLabel
            qty={buyDisabled ? 1 : qty}
            unitPrice={unitPrice}
            added={added}
          />
        </Button>
      </div>

      {/* Availability + delivery promise right where the buying decision
          happens (Baymard: reassure before the add-to-cart, not after). */}
      {!soldOut && selected?.inStock && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Check className="text-success size-3.5" />
          Нөөцөд бэлэн · Улаанбаатарт маргааш хүргэх боломжтой
        </p>
      )}

      {selected && (
        <MobileBuyBar
          show={showBuyBar}
          label={`${product.name} · ${selected.ml}ml${qty > 1 ? ` · ${qty} ш` : ""}`}
          price={formatPrice(unitPrice * qty)}
          added={added}
          onAdd={onAdd}
          onBuyNow={onBuyNow}
        />
      )}
    </div>
  );
}
