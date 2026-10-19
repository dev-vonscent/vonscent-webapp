"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/store";
import { formatPrice } from "@/lib/format";
import type { ShopExtraDetail } from "../types";

/**
 * Үнэртний хуудасны нэмэлт бараа (extras-shop-plan §9):
 *   · «Бэлгийн хайрцаг нэмэх» — нэг товчоор сагсанд («Сагсанд 1 байна»)
 *   · «Энэ үнэрийн үлдэгдэлтэй шил байна» — эх шил рүү холбоос
 * Туг хаалттай үед сервер юу ч дамжуулахгүй тул энэ хэсэг гарахгүй.
 */
export function ProductExtras({
  box,
  leftover,
}: {
  box: ShopExtraDetail | null;
  leftover: {
    slug: string;
    remainingMl: number;
    fullMl: number;
    price: number;
  } | null;
}) {
  const variant =
    box?.variants.find((v) => v.available == null || v.available > 0) ?? null;
  const inCart = useCart(
    (s) => (variant ? s.extras.find((e) => e.key === variant.id)?.qty : 0) ?? 0,
  );
  const addExtra = useCart((s) => s.addExtra);
  if (!leftover && !(box && variant)) return null;

  return (
    <div className="space-y-3">
      {leftover && (
        <Link
          href={`/extras/${leftover.slug}`}
          className="bg-secondary hover:bg-accent flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              Энэ үнэрийн үлдэгдэлтэй шил байна
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              ≈{leftover.remainingMl} / {leftover.fullMl}ml ·{" "}
              {formatPrice(leftover.price)} · Ганц ширхэг
            </span>
          </span>
          <ArrowRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
      )}
      {box && variant && (
        <div className="flex items-center gap-3 rounded-xl p-1 ">
          <Link
            href={`/extras/${box.card.slug}`}
            className="bg-secondary relative size-14 shrink-0 overflow-hidden rounded-lg"
          >
            {box.card.image ? (
              <Image
                src={box.card.image}
                alt={box.card.name}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Package className="text-muted-foreground size-5" aria-hidden />
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1 text-sm">
            <p className="line-clamp-1 font-medium">{box.card.name}</p>
            <p className="text-muted-foreground text-xs whitespace-nowrap">
              {variant.label ? `${variant.label} · ` : ""}
              {formatPrice(variant.price)}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 shrink-0"
            onClick={() =>
              addExtra(
                {
                  extraVariantId: variant.id,
                  extraId: box.card.id,
                  slug: box.card.slug,
                  name: box.card.name,
                  label: variant.label,
                  categoryName: box.card.categoryName,
                  mode: box.card.mode,
                  unitPrice: variant.price,
                  image: box.card.image,
                },
                1,
                variant.available ?? undefined,
              )
            }
          >
            {inCart > 0 ? (
              <>
                <Check className="size-4" /> Сагсанд {inCart} байна
              </>
            ) : (
              <>
                <Plus className="size-4" /> Бэлгийн хайрцаг нэмэх
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
