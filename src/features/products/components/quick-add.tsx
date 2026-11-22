"use client";

import * as React from "react";
import Image from "next/image";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCart } from "@/features/cart/store";
import { cartMlFor } from "@/features/cart/budget";
import { maxUnits } from "@/features/products/sellable";
import { trackAddToCart } from "@/lib/analytics";
import type { ProductDetail, ProductListItem } from "@/lib/types";
import {
  defaultSizeId,
  productSizeOptions,
} from "@/features/products/size-options";
import { SizeSelector } from "@/features/products/components/size-selector";
import { SizePrice } from "@/features/products/components/size-price";
import { AddToCartLabel } from "@/features/products/components/add-to-cart-label";
import {
  QUICK_ADD_CONTENT,
  QUICK_ADD_FOOTER,
  QUICK_ADD_HEADER,
  QUICK_ADD_THUMB,
  QUICK_ADD_THUMB_SIZES,
} from "@/features/products/components/quick-add-layout";

export function QuickAdd({
  product,
  className,
}: {
  product: ProductListItem;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<ProductDetail | null>(null);
  const [variantId, setVariantId] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const add = useCart((s) => s.add);
  const cartItems = useCart((s) => s.items);
  const cartCollections = useCart((s) => s.collections);

  // Fetch the full product (with variants) the first time the dialog opens.
  React.useEffect(() => {
    if (!open || detail) return;
    let cancelled = false;
    fetch(`/api/products?slug=${encodeURIComponent(product.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.product) return;
        const d = data.product as ProductDetail;
        setDetail(d);
        // Худалдаж БОЛОХ эхний хэмжээ — дууссан/савгүй хэмжээг урьдчилж
        // сонговол хэрэглэгч идэвхгүй товчтой үлдэнэ.
        // Карт өөр хэмжээний үнэ харуулж байвал (2.5) тэр хэмжээгээр.
        setVariantId(
          defaultSizeId(productSizeOptions(d.variants), product.cardPrice?.ml),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [open, detail, product.slug, product.cardPrice?.ml]);

  const activeVariants = detail?.variants.filter((v) => v.isActive) ?? [];
  const selected = activeVariants.find((v) => v.id === variantId) ?? null;
  const soldOut = detail?.soldOut ?? false;
  /**
   * Энэ хэмжээгээр авч болох дээд тоо — сагсанд аль хэдийн орсон ml-ийг
   * хассан. `sellable` нь НЭГ ширхэгийн асуулт тул түүн дээр найдвал 15ml
   * үлдэгдэлтэй бараанаас 10ml×2 сагсанд ордог.
   */
  const maxQty = !detail
    ? Infinity
    : maxUnits({
        ml: selected?.ml ?? 0,
        sellable: selected?.sellable ?? false,
        remainingMl:
          detail.availableMl -
          cartMlFor(detail.id, {
            items: cartItems,
            collections: cartCollections,
          }),
      });
  // Хэмжээ солиход, эсвэл сагс өөрчлөгдөхөд тоо ширхэг багтахаа болих нь бий.
  React.useEffect(() => {
    setQty((q) => (maxQty >= 1 ? Math.min(q, maxQty) : 1));
  }, [maxQty]);

  function onAdd() {
    if (!detail || !selected || soldOut || !selected.sellable) return;
    if (maxQty < 1) return;
    add(
      {
        productId: detail.id,
        slug: detail.slug,
        name: detail.name,
        brand: detail.brand,
        variantId: selected.id,
        ml: selected.ml,
        unitPrice: selected.price,
        basePrice: selected.basePrice,
        saleLabel: selected.saleLabel ?? null,
        image: detail.image?.url ?? null,
      },
      qty,
    );
    trackAddToCart({
      id: detail.id,
      name: `${detail.name} ${selected.ml}ml`,
      brand: detail.brand,
      price: selected.price,
      quantity: qty,
    });
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setOpen(false);
    }, 900);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Сагсанд нэмэх"
          className={cn(
            "bg-background/80 text-foreground hover:bg-background relative flex size-8 items-center justify-center rounded-full backdrop-blur transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']",
            className,
          )}
        >
          <ShoppingCart className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent className={QUICK_ADD_CONTENT}>
        <DialogTitle className="sr-only">Сагсанд нэмэх</DialogTitle>

        {/* Product summary — зураг зүүнд жижиг, мэдээлэл баруунд. */}
        <div className={QUICK_ADD_HEADER}>
          <div className={QUICK_ADD_THUMB}>
            {product.image && (
              <Image
                src={product.image.url}
                alt={product.image.alt || product.name}
                fill
                sizes={QUICK_ADD_THUMB_SIZES}
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            {/* pr-9: баруун дээд «Хаах» товчны (size-8) доогуур орохгүй. */}
            <p className="text-muted-foreground truncate pr-9 text-[11px] tracking-[0.15em] uppercase">
              {product.brand}
            </p>
            <p className="mt-1 pr-9 font-serif text-lg/tight font-medium">
              {product.name}
            </p>
            {/* Дэлгэрэнгүй хуудасных шиг үнийн хэсэг (task 15) — сонгосон
                хэмжээгээр; ачаалж дуустал «эхлэх» үнэ. */}
            <div className="mt-3">
              <SizePrice
                size="sm"
                price={selected ? selected.price : product.startingPrice}
                basePrice={
                  selected ? selected.basePrice : product.startingBasePrice
                }
                // «/ 5ml» хасав — сонгосон хэмжээ доорх сонгогч дээр тодорно;
                // нарийн баганад урт үнэтэй үед доод мөрөнд унадаг байв.
                sizeLabel={null}
                endsAt={selected?.saleEndsAt}
                reserve={
                  detail?.variants.some(
                    (v) => v.isActive && v.price < v.basePrice && v.saleEndsAt,
                  ) ?? false
                }
              />
            </div>
          </div>
        </div>

        {detail ? (
          <SizeSelector
            options={productSizeOptions(detail.variants)}
            value={variantId}
            onChange={setVariantId}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Хэмжээ сонгох</p>
            <div className="grid grid-cols-4 gap-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          </div>
        )}

        {/* Quantity + add — нэг мөрөнд (утсан дээр ч). Товчны өргөн нь
            текстээрээ (basis-auto): «Сагсанд нэмэх · 159,600₮» багтахгүй
            үед л доод мөрөнд бүтэн өргөнөөр шилжинэ (flex-wrap). */}
        <div
          className={cn(QUICK_ADD_FOOTER, "flex flex-wrap items-center gap-2")}
        >
          <div className="bg-secondary flex h-12 items-center rounded-lg">
            <button
              type="button"
              className="hover:text-foreground flex h-full items-center px-3"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Хасах"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              className="hover:text-foreground flex h-full items-center px-3 disabled:opacity-40"
              onClick={() => setQty((q) => Math.min(q + 1, maxQty))}
              disabled={qty >= maxQty}
              aria-label="Нэмэх"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <Button
            size="lg"
            className="grow basis-auto px-4"
            disabled={
              !detail ||
              !selected ||
              soldOut ||
              !selected.sellable ||
              maxQty < 1
            }
            onClick={onAdd}
          >
            {added ? (
              <AddToCartLabel qty={qty} unitPrice={0} added />
            ) : soldOut ? (
              "Дууссан"
            ) : selected && !selected.sellable ? (
              selected.unavailableReason === "bottle" ? (
                "Түр байхгүй"
              ) : (
                "Дууссан"
              )
            ) : (
              <AddToCartLabel
                qty={qty}
                unitPrice={selected?.price ?? 0}
                added={false}
              />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
