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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { toCartCollection } from "../to-cart";
import { CollectionSizePicker } from "./collection-size-picker";
import type { Collection } from "../types";

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
  collection: Collection;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [ml, setMl] = React.useState(collection.availableMls[0] ?? 0);
  const [added, setAdded] = React.useState(false);
  const labelId = React.useId();
  const addCollection = useCart((s) => s.addCollection);

  const priceRow = collection.prices.find((p) => p.ml === ml) ?? null;
  const available = priceRow?.available ?? false;

  function onAdd() {
    if (!priceRow || !available) return;
    addCollection(toCartCollection(collection, priceRow));
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
            {/* Сонгосон хэмжээний хөнгөлөлт — хэмжээ солиход дагаж өөрчлөгдөнө
                (0051: хэмжээ бүр өөр хувьтай байж болно). */}
            {priceRow && priceRow.nominalDiscountPct > 0 && (
              <Badge
                variant="sale"
                className="bg-background/85! absolute top-2.5 left-2.5 w-fit backdrop-blur-sm"
              >
                −{priceRow.nominalDiscountPct}%
              </Badge>
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
            <p className="mt-1 font-semibold tracking-tight">
              {formatPrice(priceRow?.price ?? collection.startingPrice)}
              {priceRow && priceRow.memberSum > priceRow.price && (
                <span className="text-muted-foreground ml-1.5 text-xs font-normal line-through">
                  {formatPrice(priceRow.memberSum)}
                </span>
              )}
              {priceRow && (
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  / {collection.members.length} × {priceRow.ml}ml
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Багцын хуудсынх шиг: «×4», «Хамгийн ашигтай», «Туршиж үзэх»,
            ₮/ml. space-y-3 — дээд талын шошго гарчигт наалдахгүй. */}
        <div className="space-y-3">
          <p id={labelId} className="text-sm font-medium">
            Хэмжээ сонгох
          </p>
          <CollectionSizePicker
            collection={collection}
            ml={ml}
            onChange={setMl}
            labelId={labelId}
          />
        </div>

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
