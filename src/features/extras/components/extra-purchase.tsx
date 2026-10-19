"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MobileBuyBar,
  useScrolledPast,
} from "@/components/shared/mobile-buy-bar";
import { useCart } from "@/features/cart/store";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ShopExtraDetail } from "../types";

/** Нэг мөрийн дээд тоо — захиалгын validator-тэй ижил (qty ≤ 99). */
const QTY_MAX = 99;

/**
 * Нэмэлт барааны «Захиалах / Сагсанд нэмэх» (extras-shop-plan §9).
 * Хувилбар бүр өөрийн үлдэгдэлтэй; дууссан нь идэвхгүй, «Дууссан».
 * Үлдэгдэлтэй шил ганц ширхэг — тоо сонгох хэсэггүй.
 */
export function ExtraPurchase({ extra }: { extra: ShopExtraDetail }) {
  const router = useRouter();
  const { card, variants } = extra;
  const single = card.mode === "leftover_liquid";
  const sellable = (v: (typeof variants)[number]) =>
    v.available == null || v.available > 0;
  const [variantId, setVariantId] = React.useState(
    (variants.find(sellable) ?? variants[0])?.id ?? "",
  );
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const addExtra = useCart((s) => s.addExtra);
  const startBuyNowExtra = useCart((s) => s.startBuyNowExtra);
  const inCart = useCart(
    (s) => s.extras.find((e) => e.key === variantId)?.qty ?? 0,
  );
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const ctaAway = useScrolledPast(ctaRef);

  const selected = variants.find((v) => v.id === variantId) ?? null;
  const available = selected?.available ?? null;
  // Сагсанд аль хэдийн байгааг хасаад нэмж авч болох тоо.
  const maxQty = single
    ? Math.max(1 - inCart, 0)
    : Math.min(
        QTY_MAX,
        available == null ? QTY_MAX : Math.max(available - inCart, 0),
      );
  const soldOut = card.soldOut || !selected || !sellable(selected);
  const disabled = soldOut || maxQty < 1;
  const atMax = !disabled && qty >= maxQty;

  function line() {
    if (!selected) return null;
    return {
      extraVariantId: selected.id,
      extraId: card.id,
      slug: card.slug,
      name: card.name,
      label: selected.label,
      categoryName: card.categoryName,
      mode: card.mode,
      unitPrice: selected.price,
      image: card.image,
    };
  }

  function onAdd() {
    const l = line();
    if (!l || disabled) return;
    addExtra(l, qty, available ?? undefined);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function onBuyNow() {
    const l = line();
    if (!l || disabled) return;
    startBuyNowExtra(l, qty);
    router.push("/checkout");
  }

  function onIncrement() {
    if (disabled) return;
    if (atMax) {
      toast(
        `Энэ бараанаас ${maxQty} ширхэг л авах боломжтой.`,
        "Үлдэгдэл хомс",
      );
      return;
    }
    setQty((q) => Math.min(q + 1, maxQty));
  }

  const price = selected?.price ?? card.fromPrice;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="font-serif text-3xl font-semibold whitespace-nowrap">
          {formatPrice(price)}
        </span>
        {selected?.label && variants.length > 1 && (
          <span className="text-muted-foreground pb-1 text-sm">
            / {selected.label}
          </span>
        )}
      </div>

      {variants.length > 1 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Сонголт</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => {
              const ok = sellable(v);
              const active = v.id === variantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                  aria-pressed={ok ? active : undefined}
                  aria-label={ok ? v.label : `${v.label} — дууссан`}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center rounded-lg p-2  text-center transition-colors",
                    !ok
                      ? "bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-50"
                      : active
                        ? "bg-secondary ring-foreground ring-2"
                        : "bg-secondary hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "line-clamp-2 text-sm font-semibold",
                      !ok && "line-through",
                    )}
                  >
                    {v.label || "Үндсэн"}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {ok ? formatPrice(v.price) : "Дууссан"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={ctaRef} className="space-y-3">
        <div className="flex items-center gap-4">
          {!single && (
            <div className="bg-secondary flex h-12 shrink-0 items-center rounded-md">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex h-full w-11 items-center justify-center rounded-l-md transition-colors disabled:opacity-40"
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
                type="button"
                className="text-muted-foreground hover:text-foreground data-limit:hover:text-muted-foreground flex h-full w-11 items-center justify-center rounded-r-md transition-colors disabled:opacity-40 data-limit:opacity-40"
                onClick={onIncrement}
                disabled={disabled}
                aria-disabled={atMax || undefined}
                data-limit={atMax || undefined}
                aria-label="Нэмэх"
              >
                <Plus className="size-4" />
              </button>
            </div>
          )}
          <Button
            size="lg"
            className="bg-cta text-cta-foreground hover:bg-cta/90 flex-1"
            disabled={disabled}
            onClick={onBuyNow}
          >
            {soldOut ? (single ? "Зарагдсан" : "Дууссан") : "Захиалах"}
          </Button>
        </div>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          disabled={disabled}
          onClick={onAdd}
        >
          {added ? (
            <>
              <Check className="size-4" /> Нэмэгдлээ
            </>
          ) : single && inCart > 0 ? (
            <>
              <Check className="size-4" /> Сагсанд байна
            </>
          ) : (
            <>
              <ShoppingCart className="size-4" /> Сагсанд нэмэх
            </>
          )}
        </Button>
        {qty > 1 && !disabled && (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {qty} ш × {formatPrice(price)} ={" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatPrice(price * qty)}
            </span>
          </p>
        )}
        {!disabled && available != null && available <= 5 && !single && (
          <p className="text-muted-foreground text-xs">
            {available} ширхэг үлдсэн
          </p>
        )}
      </div>

      {selected && (
        <MobileBuyBar
          show={ctaAway && !disabled}
          label={`${card.name}${selected.label ? ` · ${selected.label}` : ""}${qty > 1 ? ` · ${qty} ш` : ""}`}
          price={formatPrice(price * qty)}
          added={added}
          onAdd={onAdd}
          onBuyNow={onBuyNow}
        />
      )}
    </div>
  );
}
