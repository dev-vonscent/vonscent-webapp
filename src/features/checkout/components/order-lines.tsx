"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  collectionBasePrice,
  type CartCollection,
  type CartItem,
} from "@/features/cart/store";
import { useCartAvailability } from "@/features/cart/use-cart-availability";
import { OrderLineEditor } from "@/features/checkout/components/order-line-editor";

/** Хураасан үед харагдах мөрийн тоо. */
const COLLAPSED_LINES = 2;

type EditTarget = React.ComponentProps<typeof OrderLineEditor>["target"];

/**
 * Захиалгын тоймын барааны жагсаалт — default-оор ХУРААСАН.
 *
 * Багц бүр доороо гишүүн үнэртэн бүрээ мөр болгож жагсаадаг байсан тул 5
 * үнэртэнтэй хоёр багц л тоймыг ~300px сунгаж, «Төлбөр төлөх»-ийг десктоп
 * дээр fold-оос доош түлхдэг байв. Нэрсийг нь хасаагүй — төлөхийн өмнө
 * сонголтоо шалгах зам (cart/page.tsx-тэй ижил) «Дэлгэх»-ийн цаана үлдэнэ.
 *
 * `editable` үед мөр бүр «Засах» товчтой (клиент, 2026-09 UG): урьд нь засах
 * гэж буцсан хэрэглэгч сагсаа эхнээс нь бүрдүүлдэг байв. Засвар нь
 * `OrderLineEditor` dialog-д — мөр дотор select, stepper байхад үнэ урт болмогц
 * хяналтууд доош унаж, тойм уншигдахаа больдог байсан. Тойм өөрөө зөвхөн
 * уншина: юу, хэдэн ширхэг, ямар хэмжээ, хэд.
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
  /**
   * Засаж буй мөр — нээх үеийн хуулбар. Dialog хаагдах animation-ы турш
   * агуулга нь алга болохгүйн тулд `editing` нь `editorOpen`-оос тусдаа.
   */
  const [editing, setEditing] = React.useState<EditTarget | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  // Хуучирсан сагсны тоог үлдэгдэлд буулгаж мэдэгдэнэ («Захиалах» мөр ч мөн
  // адил) — dialog-ийг нээгээгүй байсан ч.
  useCartAvailability({ enabled: editable, buyNow });

  function edit(target: EditTarget) {
    setEditing(target);
    setEditorOpen(true);
  }

  const lines = [
    ...collections.map((c) => ({ kind: "collection" as const, c })),
    ...items.map((i) => ({ kind: "item" as const, i })),
  ];
  // Засах горимд гишүүдийн жагсаалт dialog-д — тоймд давтахгүй.
  const hasMembers = !editable && collections.some((c) => c.members.length > 0);
  const hidden = Math.max(lines.length - COLLAPSED_LINES, 0);
  const collapsible = hidden > 0 || hasMembers;
  const shown = open ? lines : lines.slice(0, COLLAPSED_LINES);

  return (
    <div className="space-y-3">
      <div id={listId} className="space-y-4">
        {shown.map((line) =>
          line.kind === "collection" ? (
            <Line
              key={line.c.key}
              image={line.c.image}
              name={line.c.name}
              qty={line.c.qty}
              meta={`Багц · ${line.c.ml}ml · ${line.c.members.length} үнэртэн`}
              price={collectionBasePrice(line.c) * line.c.qty}
              onEdit={
                editable
                  ? () => edit({ kind: "collection", line: line.c })
                  : undefined
              }
            >
              {open && hasMembers && (
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
              meta={`${line.i.brand} · ${line.i.ml}ml`}
              price={line.i.unitPrice * line.i.qty}
              onEdit={
                editable
                  ? () => edit({ kind: "item", line: line.i })
                  : undefined
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

      {editing && (
        <OrderLineEditor
          target={editing}
          buyNow={buyNow}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
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
  onEdit,
  children,
}: {
  image: string | null | undefined;
  name: string;
  qty: number;
  meta: string;
  price: number;
  /** Байвал «Засах» товч гарна (`editable`). */
  onEdit?: () => void;
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
        <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums">
          {qty}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm/tight font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-xs">{meta}</p>
        {children}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-medium tabular-nums">
          {formatPrice(price)}
        </span>
        {onEdit && (
          // Утсан дээр 44px хүрэлтийн талбай (`after:`), харагдах нь жижиг
          // капсул — тоймын нягтралыг эвдэхгүй.
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${name} — засах`}
            aria-haspopup="dialog"
            className="bg-secondary hover:bg-accent relative h-7 rounded-full px-3 text-xs font-medium transition-colors after:absolute after:-inset-x-1 after:-inset-y-2 md:after:hidden"
          >
            Засах
          </button>
        )}
      </div>
    </div>
  );
}
