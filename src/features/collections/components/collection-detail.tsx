"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import {
  MobileBuyBar,
  useScrolledPast,
} from "@/components/shared/mobile-buy-bar";
import { trackBeginCheckout } from "@/lib/analytics";
import { TRIAL_SIZE_ML } from "@/lib/constants";
import { bestValueOf } from "@/features/products/best-value";
import type { Collection } from "../types";

export function CollectionDetail({ collection }: { collection: Collection }) {
  const firstMl = collection.availableMls[0];
  const [ml, setMl] = React.useState<number>(
    firstMl ?? collection.prices[0]?.ml,
  );
  const [added, setAdded] = React.useState(false);
  const sizeRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const addCollection = useCart((s) => s.addCollection);
  const startBuyNowCollection = useCart((s) => s.startBuyNowCollection);
  const router = useRouter();

  const priceRow = collection.prices.find((p) => p.ml === ml) ?? null;
  /** Нэг хэмжээний багцад нийт хэдэн ml орох вэ: «2ml ×4» = 8ml. */
  const memberCount = collection.members.length;
  const totalMl = (size: number) => size * Math.max(memberCount, 1);
  // Дан усных шиг: хамгийн бага ₮/ml, нөөцөөс үл хамааран (best-value.ts).
  const bestValueMl =
    bestValueOf(
      collection.prices.map((p) => ({ ml: totalMl(p.ml), price: p.price })),
    )?.ml ?? null;
  const available = priceRow?.available ?? false;
  /**
   * Puts the bundle in the cart. Returns false when nothing was added.
   *
   * `mode: "buy-now"` нь «Захиалах»-ын зам: сагсанд огт хүрэлгүй, зөвхөн
   * төлбөрийн хуудсанд явах тусдаа мөр болгоно (store.ts
   * `startBuyNowCollection`).
   */
  function addToCart(mode: "add" | "buy-now" = "add"): boolean {
    if (!priceRow || !available) return false;
    const put = mode === "buy-now" ? startBuyNowCollection : addCollection;
    put({
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
    return true;
  }

  /**
   * Хэмжээний сонголт нь radiogroup — хоёрын нэгийг асаах toggle биш,
   * нэгийг нь сонгох жагсаалт. Тиймээс сум товчоор нүүж, фокус нь бүлэг дээр
   * ганцхан зогсоолтой байна (roving tabindex).
   */
  function onSizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Home",
      "End",
    ];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const list = collection.prices;
    const from = list.findIndex((p) => p.ml === ml);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else next = (from + step + list.length) % list.length;
    // Байхгүй хэмжээг алгасна — сонгох боломжгүй зүйл дээр фокус зогсоохгүй.
    for (let i = 0; i < list.length && !list[next].available; i += 1) {
      next = (next + (step || 1) + list.length) % list.length;
    }
    if (!list[next].available) return;
    setMl(list[next].ml);
    sizeRefs.current[next]?.focus();
  }

  /**
   * Гар утасны наалдсан худалдан авах зурвас — барааны хуудсынхтай ижил зан
   * (`product-purchase.tsx`). 390px дэлгэцэн дээр багцын CTA нь зураг, нэр,
   * үнэ, тайлбар, хэмжээний сүлжээ, гишүүдийн жагсаалтын ард хоёр орчим
   * дэлгэцийн доор үлддэг байсан — илүү үнэтэй бараа нь илүү урт замтай
   * болсон хэрэг.
   */
  const ctaRef = React.useRef<HTMLDivElement>(null);
  const ctaPast = useScrolledPast(ctaRef);
  const showBuyBar = ctaPast && available && !collection.soldOut;

  const addedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    [],
  );

  function onAdd() {
    if (!addToCart()) return;
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 2000);
  }

  /**
   * «Захиалах» — the same add, then straight to checkout.
   *
   * It goes *around* the cart, the way a Buy Now button is understood
   * everywhere else: the bundle never lands in the cart, so backing out leaves
   * the cart untouched and nothing already in it is quietly charged for.
   * Checkout still prices it server-side through the one shared route.
   */
  function onBuyNow() {
    if (!addToCart("buy-now")) return;
    if (priceRow) {
      trackBeginCheckout(
        [
          {
            id: collection.id,
            name: `${collection.name} ${ml}ml`,
            brand: "vonscent",
            price: priceRow.price,
            quantity: 1,
          },
        ],
        priceRow.price,
      );
    }
    router.push("/checkout");
  }

  return (
    <div className="space-y-6">
      {/* Live price — updates with ml selection. */}
      <div className="space-y-1" aria-live="polite">
        <span className="font-serif text-3xl font-semibold">
          {formatPrice(priceRow?.price ?? 0)}
        </span>
        {priceRow && priceRow.saved > 0 && (
          <p className="text-muted-foreground text-sm text-pretty">
            Тусад нь авбал{" "}
            <span className="line-through">
              {formatPrice(priceRow.memberSum)}
            </span>{" "}
            — багцаар{" "}
            <span className="text-gold-strong font-medium">
              {formatPrice(priceRow.saved)} хэмнэнэ
            </span>
          </p>
        )}
      </div>

      {/* ml segment */}
      <div className="space-y-3">
        <p id="bundle-size-label" className="text-sm font-medium">
          Хэмжээ сонгох
        </p>
        {/*
          Дөрвүүлээ нэг мөрөнд: хоёр мөр болмогц сүүлчийн хэмжээ (хамгийн
          үнэтэй нь) доод хөвдөг цэсний доогуур орж, эхний дэлгэцэнд огт
          харагдахгүй байсан.
        */}
        <div
          role="radiogroup"
          aria-labelledby="bundle-size-label"
          onKeyDown={onSizeKeyDown}
          className="grid grid-cols-4 gap-2"
        >
          {collection.prices.map((p, i) => {
            const active = p.ml === ml;
            const isBestValue = bestValueMl === totalMl(p.ml);
            // 2ml нь sample биш — энгийн хэмжээ; шошго нь зөвхөн UI санал.
            const isTrial = p.ml === TRIAL_SIZE_ML;
            return (
              <button
                key={p.ml}
                type="button"
                role="radio"
                aria-checked={active}
                aria-disabled={p.available ? undefined : true}
                tabIndex={active ? 0 : -1}
                ref={(el) => {
                  sizeRefs.current[i] = el;
                }}
                onClick={() => p.available && setMl(p.ml)}
                aria-label={`${p.ml}ml ×${memberCount}${p.available ? "" : " — байхгүй"}`}
                className={cn(
                  "relative flex flex-col items-center rounded-lg px-1 pt-2.5 pb-2 transition-colors",
                  !p.available
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                    : active
                      ? // Цул гадаргуу — «сонгогдсон» нь бүдэг өнгө биш,
                        // эргэсэн өнгө байх ёстой (/collections/build-тэй ижил).
                        "bg-foreground text-background"
                      : "bg-secondary hover:bg-accent",
                )}
              >
                {isBestValue ? (
                  <span className="bg-foreground text-background absolute -top-2 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap">
                    Хамгийн ашигтай
                  </span>
                ) : (
                  isTrial && (
                    <span className="bg-card text-foreground absolute -top-2 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap shadow-sm">
                      Туршиж үзэх
                    </span>
                  )
                )}
                {/* Зураас нь ЗӨВХӨН хэмжээн дээр — «Байхгүй» гэдэг үг өөрөө
                    төлвийг хэлж байгаа тул түүнийг дээрээс нь зурвал зүгээр
                    л уншихад хэцүү болно. «2ml ×4» — нэг үнэртний хэмжээ ×
                    үнэртний тоо, багцад нийт хэдэн ml орохыг хэлнэ. */}
                <span
                  className={cn(
                    "text-sm font-semibold whitespace-nowrap",
                    !p.available && "line-through",
                  )}
                >
                  {p.ml}ml ×{memberCount}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    active ? "text-background/75" : "text-muted-foreground",
                  )}
                >
                  {p.available ? formatPrice(p.price) : "Байхгүй"}
                </span>
                {p.available && (
                  <span
                    className={cn(
                      "text-[10px]",
                      active ? "text-background/75" : "text-muted-foreground",
                    )}
                  >
                    {formatPrice(Math.round(p.price / totalMl(p.ml)))}/ml
                  </span>
                )}
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
              className="hover:bg-accent flex items-center gap-3 rounded-lg p-2 transition-colors active:scale-[0.99]"
            >
              <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
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
                <p className="truncate text-sm font-medium" title={m.name}>
                  {m.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* «Захиалах» leads: it is the shorter road to a paid order, and the
          cart stays one tap away underneath. */}
      <div ref={ctaRef} className="space-y-3">
        <Button
          size="lg"
          className="bg-cta text-cta-foreground hover:bg-cta/90 w-full"
          disabled={!available}
          onClick={onBuyNow}
        >
          {available ? "Захиалах" : "Түр байхгүй"}
        </Button>

        {/* `outline` нь хүрээгүй системд ghost-оос ялгарахгүй тул энэ товч
            зүгээр л текст мэт харагдаж байсан — `secondary` бол системийн
            хоёрдогч гадаргуу. */}
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          disabled={!available}
          onClick={onAdd}
        >
          {added ? (
            <>
              <Check className="size-4" /> Нэмэгдлээ
            </>
          ) : (
            <>
              <ShoppingCart className="size-4" /> Сагсанд нэмэх
            </>
          )}
        </Button>
      </div>

      <MobileBuyBar
        show={showBuyBar}
        label={`${collection.name} · ${collection.members.length} × ${ml}ml`}
        price={formatPrice(priceRow?.price ?? 0)}
        added={added}
        onAdd={onAdd}
        onBuyNow={onBuyNow}
      />
    </div>
  );
}
