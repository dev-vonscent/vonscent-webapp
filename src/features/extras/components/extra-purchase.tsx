"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Info, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MobileBuyBar,
  useScrolledPast,
} from "@/components/shared/mobile-buy-bar";
import { useCart } from "@/features/cart/store";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { VIAL_STYLE_SHORT, VIAL_STYLE_SWATCH } from "@/lib/vials";
import type { ShopExtraDetail, ShopExtraVariant } from "../types";
import { useShowVariantImage } from "./variant-image";

/** Нэг мөрийн дээд тоо — захиалгын validator-тэй ижил (qty ≤ 99). */
const QTY_MAX = 99;

/**
 * Нэмэлт барааны «Захиалах / Сагсанд нэмэх» (extras-shop-plan §9, §18.5).
 * Хувилбар бүр өөрийн үлдэгдэлтэй; дууссан нь идэвхгүй, «Дууссан».
 * Грамын сав: хэмжээ → өнгө → тоо. Үлдэгдэлтэй шил ганц ширхэг — тоо
 * сонгох хэсэггүй. Анхааруулга (шприц, үлдэгдэлтэй шил) товчны дээр.
 */
export function ExtraPurchase({
  extra,
  buyBar = true,
}: {
  extra: ShopExtraDetail;
  /** Картын «Сагсанд нэмэх» цонхонд наалдсан зурвасгүй. */
  buyBar?: boolean;
}) {
  const router = useRouter();
  const { card, variants } = extra;
  const single = card.mode === "leftover_liquid";
  const vialPicker = card.mode === "shared_vial" && variants.length > 1;
  const sellable = (v: ShopExtraVariant) =>
    v.available == null || v.available > 0;
  // Галерей эхний зургаараа нээгддэг — тэр зураг аль нэг хувилбарынх бол
  // (грамын сав: мөнгөлөг 10ml) түүнийг сонгосон байдлаар эхэлнэ, эс
  // бөгөөс «Хар 5ml» сонгогдсон хажууд мөнгөлөг сав харагдана.
  const [variantId, setVariantId] = React.useState(
    (
      variants.find(
        (v) => sellable(v) && v.imageUrl && v.imageUrl === extra.images[0],
      ) ??
      variants.find(sellable) ??
      variants[0]
    )?.id ?? "",
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
  const showImage = useShowVariantImage();
  const select = (id: string) => {
    setVariantId(id);
    setQty(1);
    // Өөрийн зурагтай хувилбар (бэлгийн сав) — галерей тэр зураг руу.
    showImage(variants.find((v) => v.id === id)?.imageUrl ?? null);
  };
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
      // Хувилбарын зурагтай бол (5ml шприц, жижиг хайрцаг) сагсанд тэр.
      image: selected.imageUrl ?? card.image,
      requiresConsent: card.requiresConsent,
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

      {vialPicker && (
        <VialPicker variants={variants} selected={selected} onSelect={select} />
      )}

      {variants.length > 1 && !vialPicker && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Сонголт</p>
          {/* 3 сонголт (шприц 5/10/20ml) утсан дээр ч нэг мөрөнд. */}
          <div
            className={cn(
              "grid gap-2",
              variants.length === 3
                ? "grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3",
            )}
          >
            {variants.map((v) => {
              const ok = sellable(v);
              const active = v.id === variantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => select(v.id)}
                  aria-pressed={ok ? active : undefined}
                  aria-label={ok ? v.label : `${v.label} — үлдэгдэлгүй`}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center rounded-lg p-2 text-center transition-colors",
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

      {selected && (selected.sizeNote || selected.batchCode) && (
        <dl className="text-muted-foreground space-y-1 text-sm">
          {selected.sizeNote && (
            <div className="flex gap-2">
              <dt className="text-foreground font-medium">Хэмжээ</dt>
              <dd>{selected.sizeNote}</dd>
            </div>
          )}
          {selected.batchCode && (
            <div className="flex gap-2">
              <dt className="text-foreground font-medium">Batch code</dt>
              <dd className="tabular-nums">{selected.batchCode}</dd>
            </div>
          )}
        </dl>
      )}

      {card.notice && (
        <p className="bg-secondary flex gap-2.5 rounded-lg px-4 py-3 text-sm/relaxed">
          <Info
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <span>{card.notice}</span>
        </p>
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
        {/* Үлдэгдэл хэрэглэгчид үргэлж харагдана (§18.5); тоолоогүй сав — үгүй. */}
        {!single && available != null && (
          <p className="text-muted-foreground text-sm tabular-nums">
            {available > 0 ? `Үлдэгдэл: ${available} ширхэг` : "Дууссан"}
            {inCart > 0 && ` · сагсанд ${inCart}`}
          </p>
        )}
      </div>

      {buyBar && selected && (
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

/** Грамын сав: эхлээд хэмжээ, дараа нь тэр хэмжээний өнгө (§18.2). */
function VialPicker({
  variants,
  selected,
  onSelect,
}: {
  variants: ShopExtraVariant[];
  selected: ShopExtraVariant | null;
  onSelect: (id: string) => void;
}) {
  const sellable = (v: ShopExtraVariant) =>
    v.available == null || v.available > 0;
  const sizes = [...new Set(variants.map((v) => v.vialMl ?? 0))].sort(
    (a, b) => a - b,
  );
  const ml = selected?.vialMl ?? sizes[0];
  const colors = variants.filter((v) => v.vialMl === ml);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm font-medium">Хэмжээ</p>
        <div className="grid grid-cols-3 gap-2">
          {sizes.map((size) => {
            const inSize = variants.filter((v) => v.vialMl === size);
            const ok = inSize.some(sellable);
            const active = size === ml;
            return (
              <button
                key={size}
                type="button"
                disabled={!ok}
                onClick={() =>
                  onSelect((inSize.find(sellable) ?? inSize[0])!.id)
                }
                aria-pressed={ok ? active : undefined}
                className={cn(
                  "min-h-11 rounded-lg text-sm font-semibold tabular-nums transition-colors",
                  !ok
                    ? "bg-secondary/50 text-muted-foreground cursor-not-allowed line-through opacity-50"
                    : active
                      ? "bg-secondary ring-foreground ring-2"
                      : "bg-secondary hover:bg-accent",
                )}
              >
                {size}ml
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">
          Өнгө
          {selected?.vialStyle && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {VIAL_STYLE_SHORT[selected.vialStyle]}
            </span>
          )}
        </p>
        {/* Өнгө нь үгээр биш өнгөөрөө — савны дугуй; нэр нь доор жижгээр.
            Үнэ өнгөөр ялгаагүй тул энд биш, дээрх том үнэд. */}
        <div className="flex flex-wrap gap-4">
          {colors.map((v) => {
            const ok = sellable(v);
            const active = v.id === selected?.id;
            const name = v.vialStyle ? VIAL_STYLE_SHORT[v.vialStyle] : v.label;
            return (
              <button
                key={v.id}
                type="button"
                disabled={!ok}
                onClick={() => onSelect(v.id)}
                aria-pressed={ok ? active : undefined}
                aria-label={ok ? name : `${name} — дууссан`}
                className="group flex min-w-14 flex-col items-center gap-1.5 disabled:cursor-not-allowed"
              >
                <span
                  aria-hidden
                  style={
                    v.vialStyle
                      ? { backgroundColor: VIAL_STYLE_SWATCH[v.vialStyle] }
                      : undefined
                  }
                  className={cn(
                    "ring-offset-background relative size-10 rounded-full shadow-inner ring-offset-2 transition-shadow",
                    active
                      ? "ring-foreground ring-2"
                      : "ring-foreground/15 group-enabled:group-hover:ring-foreground/40 ring-1",
                    !ok &&
                      "opacity-40 after:absolute after:inset-x-0 after:top-1/2 after:h-px after:-rotate-45 after:bg-current",
                  )}
                />
                <span
                  className={cn(
                    "text-xs",
                    active ? "font-semibold" : "text-muted-foreground",
                    !ok && "line-through",
                  )}
                >
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
