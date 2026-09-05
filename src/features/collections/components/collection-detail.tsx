"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Gift, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { bundleGiftGuarantee } from "@/lib/gift";
import type { Collection } from "../types";

export function CollectionDetail({
  collection,
  giftPoolEnabled,
}: {
  collection: Collection;
  /** Админы бэлгийн сан идэвхтэй бөгөөд хоосон биш эсэх (backlog A2). */
  giftPoolEnabled: boolean;
}) {
  const firstMl = collection.availableMls[0];
  const [ml, setMl] = React.useState<number>(
    firstMl ?? collection.prices[0]?.ml,
  );
  const [added, setAdded] = React.useState(false);

  const addCollection = useCart((s) => s.addCollection);

  const priceRow = collection.prices.find((p) => p.ml === ml) ?? null;
  const available = priceRow?.available ?? false;
  // Багц өөрөө бэлэг «авчирдаггүй» — зөвхөн бэлгийн эрх өгнө, бэлгээ
  // худалдан авагч төлбөрийн хуудсанд админы сангаас сонгоно (backlog A2).
  const giftGuarantee = bundleGiftGuarantee({
    type: collection.type,
    ml,
    qty: 1,
  });

  function onAdd() {
    if (!priceRow || !available) return;
    addCollection({
      collectionId: collection.id,
      type: collection.type,
      slug: collection.slug,
      name: collection.name,
      image: collection.image,
      // The rate for the size being bought, not the bundle default: with
      // per-size discounts (0051) those differ, and the cart would otherwise
      // show a percentage the customer is not getting.
      discountPct: priceRow.discountPct,
      ml,
      members: collection.members.map((m) => {
        const v = m.variantByMl[ml];
        return {
          productId: m.productId,
          variantId: v.variantId,
          slug: m.slug,
          name: m.name,
          brand: m.brand,
          image: m.image?.url ?? null,
          price: v.price,
        };
      }),
      unitPrice: priceRow.price,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Live price — updates with ml selection */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="font-serif text-3xl font-semibold">
          {formatPrice(priceRow?.price ?? 0)}
        </span>
        <span className="text-muted-foreground pb-1 text-sm">
          / {ml}ml багц
        </span>
        {priceRow && priceRow.saved > 0 && (
          <span className="flex items-baseline gap-2 pb-0.5">
            <span className="text-muted-foreground text-sm line-through">
              {formatPrice(priceRow.memberSum)}
            </span>
            <span className="text-gold-strong text-sm font-medium">
              {formatPrice(priceRow.saved)} хэмнэнэ
            </span>
          </span>
        )}
      </div>

      {collection.description && (
        <p className="text-foreground/80 text-sm/relaxed ">
          {collection.description}
        </p>
      )}

      {/* ml segment */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Хэмжээ сонгох</p>
        <div className="flex flex-wrap gap-2">
          {collection.prices.map((p) => {
            const active = p.ml === ml;
            return (
              <button
                key={p.ml}
                onClick={() => setMl(p.ml)}
                disabled={!p.available}
                aria-pressed={active}
                aria-label={p.available ? `${p.ml}ml` : `${p.ml}ml — байхгүй`}
                className={cn(
                  "flex min-w-24 flex-col items-center rounded-lg px-4 py-2 transition-colors",
                  !p.available
                    ? "bg-secondary/50 text-muted-foreground cursor-not-allowed line-through opacity-50"
                    : active
                      ? "bg-foreground/30"
                      : "bg-secondary hover:bg-accent",
                )}
              >
                <span className="text-sm font-semibold">{p.ml}ml</span>
                <span className="text-muted-foreground text-xs">
                  {p.available ? formatPrice(p.price) : "Байхгүй"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Members */}
      <div className="space-y-3">
        <p className="text-sm font-medium">
          Багцын үнэртэн ({collection.members.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {collection.members.map((m) => (
            <Link
              key={m.productId}
              href={`/products/${m.slug}`}
              className="border-border hover:bg-accent flex items-center gap-3 rounded-lg border p-2 transition-colors"
            >
              <div className="bg-muted border-border relative size-12 shrink-0 overflow-hidden rounded-md border">
                {m.image && (
                  <Image
                    src={m.image.url}
                    alt={m.image.alt || m.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  {m.brand}
                </p>
                <p className="truncate text-sm font-medium">{m.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Бэлгийн эрх — сонголт нь checkout дээр */}
      {giftPoolEnabled && giftGuarantee > 0 && (
        <p className="border-border bg-secondary/60 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <Gift className="text-gold-strong mt-0.5 size-4 shrink-0" />
          <span>
            Энэ багц <strong>1мл бэлгийн дээж</strong> дагалдана — бэлгээ
            төлбөрийн хуудсанд бэлгийн уснуудаас сонгоно.
          </span>
        </p>
      )}

      {/* Add to cart */}
      <Button
        size="lg"
        className="w-full in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
        disabled={!available}
        onClick={onAdd}
      >
        {added ? (
          <>
            <Check className="size-4" /> Нэмэгдлээ
          </>
        ) : !available ? (
          "Түр байхгүй"
        ) : (
          <>
            <ShoppingCart className="size-4" /> Сагсанд нэмэх
          </>
        )}
      </Button>
    </div>
  );
}
