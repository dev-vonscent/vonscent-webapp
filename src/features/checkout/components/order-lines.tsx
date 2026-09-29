"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  collectionBasePrice,
  useCart,
  type CartCollection,
  type CartItem,
} from "@/features/cart/store";
import { useCartAvailability } from "@/features/cart/use-cart-availability";
import { CartSizeSelect } from "@/features/cart/components/cart-size-select";

/** Хураасан үед харагдах мөрийн тоо. */
const COLLAPSED_LINES = 2;

/**
 * Захиалгын тоймын барааны жагсаалт — default-оор ХУРААСАН.
 *
 * Багц бүр доороо гишүүн үнэртэн бүрээ мөр болгож жагсаадаг байсан тул 5
 * үнэртэнтэй хоёр багц л тоймыг ~300px сунгаж, «Төлбөр төлөх»-ийг десктоп
 * дээр fold-оос доош түлхдэг байв. Нэрсийг нь хасаагүй — төлөхийн өмнө
 * сонголтоо шалгах зам (cart/page.tsx-тэй ижил) «Дэлгэх»-ийн цаана үлдэнэ.
 *
 * `editable` үед мөр бүр тоо ширхэг, хэмжээ (дан ус), устгах товчтой
 * (клиент, 2026-09 UG): урьд нь засах гэж буцсан хэрэглэгч сагсаа эхнээс нь
 * бүрдүүлдэг байв. Засвар нь сагсны store руу ШУУД бичигдэх тул буцахад сагс
 * ижил, купон / бэлэг / оноо ч store-ын дүнгээс дахин бодогдоно. «Захиалах»
 * мөр сагсанд байдаггүй тул түүний засвар `buyNow` руу очно, устгах товчгүй —
 * ганц мөрөө хасвал хуудас сагсны мөрүүд рүү чимээгүй шилжих байсан.
 */
export function OrderLines({
  items,
  collections,
  editable = false,
  buyNow = false,
}: {
  items: CartItem[];
  collections: CartCollection[];
  editable?: boolean;
  /** Мөрүүд нь «Захиалах» замаас ирсэн эсэх (`useCheckoutLines`). */
  buyNow?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();

  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setCollectionQty = useCart((s) => s.setCollectionQty);
  const removeCollection = useCart((s) => s.removeCollection);
  const setBuyNowQty = useCart((s) => s.setBuyNowQty);
  const setBuyNowVariant = useCart((s) => s.setBuyNowVariant);
  // Сагсны мөрийн дээд тоо (эх савны үлдэгдэл). «Захиалах» мөр сагсанд
  // байдаггүй тул хязгааргүй — серверийн INSUFFICIENT_STOCK шалгалт хамгаална.
  const { maxQtyOf, maxCollectionQtyOf } = useCartAvailability({
    enabled: editable && !buyNow,
  });

  const lines = [
    ...collections.map((c) => ({ kind: "collection" as const, c })),
    ...items.map((i) => ({ kind: "item" as const, i })),
  ];
  const hasMembers = collections.some((c) => c.members.length > 0);
  const hidden = Math.max(lines.length - COLLAPSED_LINES, 0);
  const collapsible = hidden > 0 || hasMembers;
  const shown = open ? lines : lines.slice(0, COLLAPSED_LINES);

  return (
    <div className="space-y-3">
      <div id={listId} className="space-y-3">
        {shown.map((line) =>
          line.kind === "collection" ? (
            <Line
              key={line.c.key}
              image={line.c.image}
              name={line.c.name}
              qty={line.c.qty}
              meta={`Багц · ${line.c.ml}ml · ${line.c.members.length} үнэртэн`}
              price={collectionBasePrice(line.c) * line.c.qty}
              controls={
                editable && (
                  <LineControls
                    name={line.c.name}
                    qty={line.c.qty}
                    max={buyNow ? Infinity : maxCollectionQtyOf(line.c.key)}
                    onQty={(q, max) =>
                      buyNow
                        ? setBuyNowQty(q, max)
                        : setCollectionQty(line.c.key, q, max)
                    }
                    onRemove={
                      buyNow ? undefined : () => removeCollection(line.c.key)
                    }
                  />
                )
              }
            >
              {open && (
                <ul className="text-muted-foreground mt-0.5 space-y-0.5 text-xs">
                  {line.c.members.map((m) => (
                    <li key={m.variantId} className="truncate">
                      • {m.brand} — {m.name}
                    </li>
                  ))}
                </ul>
              )}
            </Line>
          ) : (
            <Line
              key={line.i.key}
              image={line.i.image}
              name={line.i.name}
              qty={line.i.qty}
              meta={
                editable ? line.i.brand : `${line.i.brand} · ${line.i.ml}ml`
              }
              price={line.i.unitPrice * line.i.qty}
              controls={
                editable && (
                  <LineControls
                    name={line.i.name}
                    qty={line.i.qty}
                    max={buyNow ? Infinity : maxQtyOf(line.i.key)}
                    onQty={(q, max) =>
                      buyNow ? setBuyNowQty(q, max) : setQty(line.i.key, q, max)
                    }
                    onRemove={buyNow ? undefined : () => remove(line.i.key)}
                  >
                    <CartSizeSelect
                      itemKey={line.i.key}
                      slug={line.i.slug}
                      variantId={line.i.variantId}
                      ml={line.i.ml}
                      onPick={buyNow ? setBuyNowVariant : undefined}
                      className="h-8 w-28 text-xs"
                    />
                  </LineControls>
                )
              }
            />
          ),
        )}
      </div>

      {collapsible && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
        >
          {open
            ? "Хураах"
            : hidden > 0
              ? `Дэлгэх · дахиад ${hidden} бараа`
              : "Дэлгэх · багцын үнэртнүүд"}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      )}
    </div>
  );
}

/** Мөр засах эгнээ: [хэмжээ] [− n +] … [устгах]. */
function LineControls({
  name,
  qty,
  max,
  onQty,
  onRemove,
  children,
}: {
  name: string;
  qty: number;
  max: number;
  onQty: (qty: number, max?: number) => void;
  /** Байхгүй бол устгах товч гарахгүй («Захиалах» мөр). */
  onRemove?: () => void;
  /** Хэмжээ сонгох (зөвхөн дан ус). */
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {children}
      <div className="bg-secondary flex items-center rounded-full">
        <button
          type="button"
          onClick={() => onQty(qty - 1)}
          disabled={qty <= 1}
          aria-label={`${name} — нэгээр хасах`}
          className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full disabled:opacity-40 md:size-8"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
        <button
          type="button"
          onClick={() => onQty(qty + 1, max)}
          disabled={qty >= max}
          aria-label={`${name} — нэгээр нэмэх`}
          className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full disabled:opacity-40 md:size-8"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} — устгах`}
          className="text-muted-foreground hover:text-destructive flex size-11 items-center justify-center rounded-full md:size-8"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

function Line({
  image,
  name,
  qty,
  meta,
  price,
  controls,
  children,
}: {
  image: string | null | undefined;
  name: string;
  qty: number;
  meta: string;
  price: number;
  /** Засах эгнээ (`editable`) — нэр, тайлбарын доор. */
  controls?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Тоо ширхгийн тэмдэг зургийн хүрээний *гадна* байх ёстой:
          `overflow-hidden` дотор байхдаа хагас хайчлагдаж, зураг дээр хар
          зэрэг шиг харагддаг. */}
      <div className="relative size-12 shrink-0">
        <div className="bg-muted relative size-full overflow-hidden rounded-xl">
          {image && (
            <Image
              src={image}
              alt={name}
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </div>
        {/* Засах үед тоо нь stepper дээр — давхар хэлэхгүй. */}
        {!controls && (
          <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
            {qty}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm/tight font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-xs">{meta}</p>
        {children}
        {controls}
      </div>
      <span className="text-sm font-medium tabular-nums">
        {formatPrice(price)}
      </span>
    </div>
  );
}
