"use client";

import * as React from "react";
import Image from "next/image";
import { ShoppingCart, Minus, Plus, Check } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import type { ProductDetail, ProductListItem } from "@/lib/types";

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
        const first = d.variants.find((v) => v.isActive);
        setVariantId(first?.id ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, [open, detail, product.slug]);

  const activeVariants = detail?.variants.filter((v) => v.isActive) ?? [];
  const selected = activeVariants.find((v) => v.id === variantId) ?? null;
  const soldOut = detail?.soldOut ?? false;

  function onAdd() {
    if (!detail || !selected || soldOut) return;
    add(
      {
        productId: detail.id,
        slug: detail.slug,
        name: detail.name,
        brand: detail.brand,
        variantId: selected.id,
        ml: selected.ml,
        unitPrice: selected.price,
        image: detail.image?.url ?? null,
      },
      qty,
    );
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
            "bg-background/80 text-foreground hover:bg-background flex size-8 items-center justify-center rounded-full backdrop-blur transition-colors",
            className,
          )}
        >
          <ShoppingCart className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="gap-3 p-4 sm:gap-4 sm:p-6">
        <DialogTitle className="sr-only">Сагсанд нэмэх</DialogTitle>

        {/* Product summary */}
        <div className="space-y-3">
          <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden rounded-xl">
            {product.image && (
              <Image
                src={product.image.url}
                alt={product.image.alt || product.name}
                fill
                sizes="(max-width: 480px) 90vw, 420px"
                className="object-cover"
              />
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
              {product.brand}
            </p>
            <p className="font-serif text-base leading-tight font-medium">
              {product.name}
            </p>
            <p className="mt-1 font-semibold tracking-tight">
              {selected
                ? formatPrice(selected.price)
                : formatPrice(product.startingPrice)}
              {selected && (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  / {selected.ml}ml
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Size options */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Хэмжээ сонгох</p>
          {detail ? (
            <div className="flex flex-wrap gap-2">
              {activeVariants.map((v) => {
                const active = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      "flex min-w-[4.5rem] flex-col items-center rounded-lg px-4 py-2 transition-colors",
                      active
                        ? "bg-foreground/30"
                        : "bg-secondary hover:bg-accent",
                    )}
                  >
                    <span className="text-sm font-semibold">{v.ml}ml</span>
                    <span className="text-muted-foreground text-xs">
                      {formatPrice(v.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-2">
              <Skeleton className="h-12 w-[4.5rem] rounded-lg" />
              <Skeleton className="h-12 w-[4.5rem] rounded-lg" />
              <Skeleton className="h-12 w-[4.5rem] rounded-lg" />
            </div>
          )}
        </div>

        {/* Quantity + add */}
        <div className="flex items-center gap-3">
          <div className="bg-secondary flex items-center rounded-md">
            <button
              type="button"
              className="hover:text-foreground px-3 py-2"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Хасах"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center text-sm">{qty}</span>
            <button
              type="button"
              className="hover:text-foreground px-3 py-2"
              onClick={() => setQty((q) => q + 1)}
              aria-label="Нэмэх"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <Button
            size="lg"
            className="flex-1"
            disabled={!detail || !selected || soldOut}
            onClick={onAdd}
          >
            {added ? (
              <>
                <Check className="size-4" /> Нэмэгдлээ
              </>
            ) : soldOut ? (
              "Дууссан"
            ) : (
              <>
                <ShoppingCart className="size-4" /> Сагслах
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
