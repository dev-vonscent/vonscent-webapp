"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Gift, Minus, Plus, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import { bundleGiftGuarantee } from "@/lib/gift";
import { useGiftPool } from "@/features/gifts/use-gift-pool";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  useCart,
  selectCount,
  selectSubtotal,
  type CartItem,
} from "@/features/cart/store";
import { CartSizeSelect } from "@/features/cart/components/cart-size-select";

export function CartSheet({
  triggerVariant = "ghost",
  triggerClassName,
  label,
}: {
  triggerVariant?: ButtonProps["variant"];
  triggerClassName?: string;
  /** When set, the trigger shows this text beside the icon (nav-style). */
  label?: string;
} = {}) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const collections = useCart((s) => s.collections);
  const setCollectionQty = useCart((s) => s.setCollectionQty);
  const removeCollection = useCart((s) => s.removeCollection);
  const giftPool = useGiftPool();
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);

  const add = useCart((s) => s.add);

  // Avoid hydration mismatch from persisted store.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Radix focuses the first tabbable child on open — which is line 1's size
  // select, where two arrow keys silently rewrite the order. Anchor focus on
  // the title instead, so nothing destructive is one keystroke away.
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  // Removing a line is irreversible in the store, so the sheet holds the last
  // removed item for a few seconds and offers it back.
  const [undo, setUndo] = React.useState<CartItem | null>(null);
  const undoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  function removeWithUndo(item: CartItem) {
    remove(item.key);
    setUndo(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }

  function restore() {
    if (!undo) return;
    const { qty, ...rest } = undo;
    add(rest, qty);
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant={triggerVariant}
          size={label ? "default" : "icon"}
          className={cn("relative", triggerClassName)}
          aria-label="Сагс"
        >
          <ShoppingCart className="size-5" />
          {label && <span>{label}</span>}
          {mounted && count > 0 && (
            <span className="bg-foreground text-background absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-md gap-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle ref={titleRef} tabIndex={-1}>
            Таны сагс {mounted && count > 0 && `(${count})`}
          </SheetTitle>
        </SheetHeader>

        {!mounted || (items.length === 0 && collections.length === 0) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingCart className="text-muted-foreground size-10" />
            <p className="text-muted-foreground text-sm text-balance">
              Сагс хоосон байна. Дуртай үнэртнээ 2ml-ээс эхлэн туршиж үзээрэй.
            </p>
            <div className="flex flex-col items-center gap-2">
              <SheetClose asChild>
                <Button asChild variant="secondary">
                  <Link href="/catalog">Бараа үзэх</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/collections">Багц үзэх</Link>
                </Button>
              </SheetClose>
            </div>
          </div>
        ) : (
          <>
            <MotionConfig reducedMotion="user">
              <div className="-mx-2 flex-1 space-y-4 overflow-y-auto px-2 py-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {/* Bundles — rendered as one grouped card each */}
                  {collections.map((c) => (
                    <motion.div
                      key={c.key}
                      layout
                      exit={{ opacity: 0, x: 48 }}
                      transition={{ duration: 0.2 }}
                      className="bg-secondary/50 rounded-lg p-3"
                    >
                      <div className="flex gap-3">
                        <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
                          {c.image && (
                            <Image
                              src={c.image}
                              alt={c.name}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm/tight  font-medium">
                                {c.name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="text-muted-foreground text-xs">
                                  {c.ml}ml багц
                                </span>
                                {c.discountPct > 0 && (
                                  <Badge
                                    variant="sale"
                                    className="h-4 px-1 text-[10px]"
                                  >
                                    −{c.discountPct}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removeCollection(c.key)}
                              className="text-muted-foreground hover:text-destructive -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full md:size-9"
                              aria-label="Устгах"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Members + бэлгийн эрхийн сануулга */}
                      <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                        {c.members.map((m) => (
                          <li key={m.variantId} className="truncate">
                            • {m.brand} — {m.name}
                          </li>
                        ))}
                        {giftPool?.enabled && bundleGiftGuarantee(c) > 0 && (
                          <li className="text-foreground/80 flex items-center gap-1">
                            <Gift className="text-gold-strong size-3 shrink-0" />
                            1мл бэлгийн эрхтэй — төлбөрийн хуудсанд сонгоно
                          </li>
                        )}
                      </ul>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="bg-secondary flex items-center rounded-full">
                          <button
                            className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full md:size-9"
                            onClick={() => setCollectionQty(c.key, c.qty - 1)}
                            aria-label="Хасах"
                          >
                            <Minus className="size-4 md:size-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums md:w-6">
                            {c.qty}
                          </span>
                          <button
                            className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full md:size-9"
                            onClick={() => setCollectionQty(c.key, c.qty + 1)}
                            aria-label="Нэмэх"
                          >
                            <Plus className="size-4 md:size-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-medium">
                          {formatPrice(c.unitPrice * c.qty)}
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {items.map((item) => (
                    <motion.div
                      key={item.key}
                      layout
                      exit={{ opacity: 0, x: 48 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-3"
                    >
                      <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {item.brand}
                            </p>
                            <p className="text-sm/tight  font-medium">
                              {item.name}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <CartSizeSelect
                                itemKey={item.key}
                                slug={item.slug}
                                variantId={item.variantId}
                                ml={item.ml}
                                className="h-7 w-32 text-xs"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => removeWithUndo(item)}
                            className="text-muted-foreground hover:text-destructive -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full md:size-9"
                            aria-label="Устгах"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="bg-secondary flex items-center rounded-full">
                            <button
                              className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full md:size-9"
                              onClick={() => setQty(item.key, item.qty - 1)}
                              aria-label="Хасах"
                            >
                              <Minus className="size-4 md:size-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm tabular-nums md:w-6">
                              {item.qty}
                            </span>
                            <button
                              className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full md:size-9"
                              onClick={() => setQty(item.key, item.qty + 1)}
                              aria-label="Нэмэх"
                            >
                              <Plus className="size-4 md:size-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-medium tabular-nums">
                            {formatPrice(item.unitPrice * item.qty)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </MotionConfig>

            {/* Borders collapse to transparent, so the rule that separates the
                list from the money area has to be a real surface. */}
            <div className="bg-secondary -mx-6 h-px" />
            <div className="pb-safe space-y-4 pt-4">
              {undo && (
                <div className="bg-secondary flex items-center justify-between gap-2 rounded-lg pr-1 pl-3">
                  <span className="text-muted-foreground truncate text-xs">
                    «{undo.name}» устгагдлаа
                  </span>
                  <button
                    type="button"
                    onClick={restore}
                    className="text-foreground flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium md:h-9"
                  >
                    <Undo2 className="size-3.5" />
                    Буцаах
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Дэд дүн</span>
                <span className="font-medium tabular-nums">
                  {formatPrice(subtotal)}
                </span>
              </div>
              {/* No figure here on purpose: the fee depends on the delivery
                  zone, which is only known once an address is chosen. */}
              <p className="text-muted-foreground text-xs text-balance">
                Хүргэлтийн төлбөр хаягийн бүсээс хамаарч нэмэгдэнэ — эцсийн
                дүнг захиалгын хуудсанд харна.
              </p>
              <SheetClose asChild>
                <Button
                  asChild
                  className="in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90 w-full"
                  size="lg"
                >
                  <Link href="/checkout">Захиалах</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/cart">Сагс харах</Link>
                </Button>
              </SheetClose>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
