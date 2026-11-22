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
import {
  QUICK_ADD_CONTENT,
  QUICK_ADD_FOOTER,
  QUICK_ADD_HEADER,
  QUICK_ADD_THUMB,
  QUICK_ADD_THUMB_SIZES,
} from "@/features/products/components/quick-add-layout";
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

      <DialogContent className={QUICK_ADD_CONTENT}>
        <DialogTitle className="sr-only">Сагсанд нэмэх</DialogTitle>

        {/* Зураг зүүнд жижиг, мэдээлэл баруунд (барааны quick-add-тай ижил). */}
        <div className="flex flex-col gap-3">
          <div className={QUICK_ADD_HEADER}>
            <div className={QUICK_ADD_THUMB}>
              {collection.image && (
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  sizes={QUICK_ADD_THUMB_SIZES}
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              {/* pr-9: баруун дээд «Хаах» товчны (size-8) доогуур орохгүй. */}
              <p className="text-muted-foreground truncate pr-9 text-[11px] tracking-[0.15em] uppercase">
                Багц · {collection.members.length} үнэртэн
              </p>
              <p className="mt-1 pr-9 font-serif text-lg/tight font-medium">
                {collection.name}
              </p>
              {/* Хувь нь энд (task 15) — зураг дээрх «−5%» тэмдэг хасагдсан. */}
              <div className="mt-3">
                <SizePrice
                  size="sm"
                  price={priceRow?.price ?? collection.startingPrice}
                  basePrice={priceRow?.memberSum ?? 0}
                  pct={priceRow?.nominalDiscountPct}
                  // «/ 4 × 20ml» хасав: нарийн баганад урт үнэтэй үед доод
                  // мөрөнд унадаг; сонгосон хэмжээ доорх сонгогч дээр тодорно.
                  sizeLabel={null}
                  endsAt={
                    bundlesOn
                      ? bundleSizeSaleEndsAt(collection, priceRow)
                      : null
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
          {/* Гишүүд — юу авч байгаагаа цонхноосоо гаралгүй харна (жижиг
            зурган дээр савыг таних боломжгүй). Бүтэн өргөнөөр outlined chip:
            дарагддаггүй мэдээлэл тул дэвсгэргүй, зөвхөн нимгэн хүрээ. */}
          <ul
            aria-label="Багцад орсон үнэртэн"
            className="flex flex-wrap gap-1.5"
          >
            {collection.members.map((m) => (
              <li
                key={m.productId}
                className="ring-foreground/15 text-foreground/80 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset"
              >
                {m.name}
              </li>
            ))}
          </ul>
        </div>

        <SizeSelector
          options={sizeOptions}
          value={String(ml)}
          onChange={(id) => setMl(Number(id))}
        />

        <div className={QUICK_ADD_FOOTER}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
