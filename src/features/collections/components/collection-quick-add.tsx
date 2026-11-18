"use client";

import * as React from "react";
import Image from "next/image";
import { ShoppingCart, Check } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "@/features/cart/store";
import { trackAddToCart } from "@/lib/analytics";
import { toCartCollection } from "../to-cart";
import { useFeatureFlag } from "@/components/feature-flags";
import { defaultSizeId } from "@/features/products/size-options";
import { SizeSelector } from "@/features/products/components/size-selector";
import { SizePrice } from "@/features/products/components/size-price";
import { bundleSizeOptions, bundleSizeSaleEndsAt } from "../size-options";
import { bundleCardPrice } from "../pricing";
import type { CollectionCardData } from "../types";

/**
 * Нүүрний rail дахь багцын «Сагсанд нэмэх» — барааны `QuickAdd`-ийн ихэр.
 * Багцын үнэ, үлдэгдэл `Collection` дотор аль хэдийн байгаа тул нэмэлт
 * хүсэлт явуулахгүй. Багцын хуудсын адил нэг дарахад нэг багц нэмнэ — тоог
 * сагсанд тохируулна (тэнд гишүүн бүрийн үлдэгдлээр хязгаарлагдана).
 */
export function CollectionQuickAdd({
  collection,
  className,
}: {
  collection: CollectionCardData;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const sizeOptions = bundleSizeOptions(collection);
  // Карт event-ийн хэмжээний үнэ харуулж байвал (2.5) тэр хэмжээгээр.
  const [ml, setMl] = React.useState(() =>
    Number(defaultSizeId(sizeOptions, bundleCardPrice(collection.prices)?.ml)),
  );
  const [added, setAdded] = React.useState(false);
  const bundlesOn = useFeatureFlag("sale_event_bundles");
  const addCollection = useCart((s) => s.addCollection);

  const priceRow = collection.prices.find((p) => p.ml === ml) ?? null;
  const available = priceRow?.available ?? false;

  function onAdd() {
    if (!priceRow || !available) return;
    addCollection(toCartCollection(collection, priceRow));
    trackAddToCart({
      id: collection.id,
      name: `${collection.name} ${ml}ml`,
      brand: "vonscent",
      price: priceRow.price,
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

      <DialogContent className="gap-3 p-4 sm:gap-4 sm:p-6">
        <DialogTitle className="sr-only">Сагсанд нэмэх</DialogTitle>

        <div className="space-y-3">
          <div className="bg-muted relative aspect-4/3 w-full overflow-hidden rounded-xl">
            {collection.image && (
              <Image
                src={collection.image}
                alt={collection.name}
                fill
                sizes="(max-width: 480px) 90vw, 420px"
                className="object-cover"
              />
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
              Багц · {collection.members.length} үнэртэн
            </p>
            <p className="font-serif text-base/tight font-medium">
              {collection.name}
            </p>
            {/* Гишүүд — юу авч байгаагаа цонхноосоо гаралгүй харна. */}
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {collection.members.map((m) => m.name).join(" · ")}
            </p>
            {/* Хувь нь энд (task 15) — зураг дээрх «−5%» тэмдэг хасагдсан. */}
            <div className="mt-1">
              <SizePrice
                size="sm"
                price={priceRow?.price ?? collection.startingPrice}
                basePrice={priceRow?.memberSum ?? 0}
                pct={priceRow?.nominalDiscountPct}
                sizeLabel={
                  priceRow
                    ? `${collection.members.length} × ${priceRow.ml}ml`
                    : null
                }
                endsAt={
                  bundlesOn ? bundleSizeSaleEndsAt(collection, priceRow) : null
                }
                reserve={
                  bundlesOn &&
                  collection.prices.some((p) =>
                    bundleSizeSaleEndsAt(collection, p),
                  )
                }
              />
            </div>
          </div>
        </div>

        <SizeSelector
          options={sizeOptions}
          value={String(ml)}
          onChange={(id) => setMl(Number(id))}
        />

        <Button
          size="lg"
          className="w-full"
          disabled={!priceRow || !available}
          onClick={onAdd}
        >
          {added ? (
            <>
              <Check className="size-4" /> Нэмэгдлээ
            </>
          ) : !available ? (
            "Дууссан"
          ) : (
            <>
              <ShoppingCart className="size-4" /> Сагслах
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
