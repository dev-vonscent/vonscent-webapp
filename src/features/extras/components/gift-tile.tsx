"use client";

import Image from "next/image";
import { Check, Package, Plus } from "lucide-react";
import type { CartExtra } from "@/features/cart/store";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ShopExtraDetail, ShopExtraVariant } from "../types";

/** Бэлгийн сав + зарагдах эхний хувилбар (дууссан хувилбарыг алгасна). */
export interface GiftOffer {
  gift: ShopExtraDetail;
  variant: ShopExtraVariant;
}

export function giftOffers(gifts: readonly ShopExtraDetail[]): GiftOffer[] {
  return gifts.flatMap((gift) => {
    const variant =
      gift.variants.find((v) => v.available == null || v.available > 0) ?? null;
    return variant ? [{ gift, variant }] : [];
  });
}

/** Сагс / «Захиалах» мөрийн оролт. */
export function giftLine({
  gift: { card },
  variant,
}: GiftOffer): Omit<CartExtra, "key" | "qty"> {
  return {
    extraVariantId: variant.id,
    extraId: card.id,
    slug: card.slug,
    name: card.name,
    label: variant.label,
    categoryName: card.categoryName,
    mode: card.mode,
    unitPrice: variant.price,
    image: card.image,
    requiresConsent: card.requiresConsent,
  };
}

/**
 * Бэлгийн савны сонгох нүд — үнэртний хуудасны «Бэлэглэх бол», төлбөрийн
 * хуудасны «Бэлгийн боодол» хоёулаа (нэг хэлбэр). Дахин дарахад болино.
 */
export function GiftTile({
  offer: { gift, variant },
  selected,
  onToggle,
}: {
  offer: GiftOffer;
  selected: boolean;
  onToggle: () => void;
}) {
  const { card } = gift;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${card.name}, ${formatPrice(variant.price)}`}
      className={cn(
        // Зураг чирэгдэж, текст сонгогдохгүй — товч л.
        "bg-secondary relative flex size-full flex-col gap-1.5 rounded-xl p-1.5 text-left select-none [-webkit-touch-callout:none]",
        selected && "ring-foreground ring-2",
      )}
    >
      <span className="bg-card relative block aspect-square w-full overflow-hidden rounded-lg">
        {card.image ? (
          <Image
            src={card.image}
            alt=""
            fill
            draggable={false}
            sizes="120px"
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Package className="text-muted-foreground size-5" aria-hidden />
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            "absolute top-1 right-1 flex size-6 items-center justify-center rounded-full",
            selected
              ? "bg-cta text-cta-foreground"
              : "bg-background/85 text-foreground backdrop-blur-sm",
          )}
        >
          {selected ? (
            <Check className="size-3.5" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </span>
      </span>
      <span className="px-0.5 pb-0.5">
        <span className="line-clamp-2 text-xs/tight font-medium">
          {card.name}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
          {formatPrice(variant.price)}
        </span>
      </span>
    </button>
  );
}
