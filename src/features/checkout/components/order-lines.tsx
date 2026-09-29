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

/** Хураасан үед харагдах мөрийн тоо. */
const COLLAPSED_LINES = 2;

/**
 * Захиалгын тоймын барааны жагсаалт — default-оор ХУРААСАН.
 *
 * Багц бүр доороо гишүүн үнэртэн бүрээ мөр болгож жагсаадаг байсан тул 5
 * үнэртэнтэй хоёр багц л тоймыг ~300px сунгаж, «Төлбөр төлөх»-ийг десктоп
 * дээр fold-оос доош түлхдэг байв. Нэрсийг нь хасаагүй — төлөхийн өмнө
 * сонголтоо шалгах зам (cart/page.tsx-тэй ижил) «Дэлгэх»-ийн цаана үлдэнэ.
 */
export function OrderLines({
  items,
  collections,
}: {
  items: CartItem[];
  collections: CartCollection[];
}) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();

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
              meta={`${line.i.brand} · ${line.i.ml}ml`}
              price={line.i.unitPrice * line.i.qty}
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
              : "Дэлгэх · багцын үнэртэнүүд"}
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

function Line({
  image,
  name,
  qty,
  meta,
  price,
  children,
}: {
  image: string | null | undefined;
  name: string;
  qty: number;
  meta: string;
  price: number;
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
        <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
          {qty}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm/tight font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-xs">{meta}</p>
        {children}
      </div>
      <span className="text-sm font-medium tabular-nums">
        {formatPrice(price)}
      </span>
    </div>
  );
}
