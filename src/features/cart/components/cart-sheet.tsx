"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart, selectCount, selectSubtotal } from "@/features/cart/store";
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
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);

  // Avoid hydration mismatch from persisted store.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md gap-0">
        <SheetHeader>
          <SheetTitle>Таны сагс {mounted && count > 0 && `(${count})`}</SheetTitle>
        </SheetHeader>

        {!mounted || items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingCart className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Сагс хоосон байна.</p>
            <SheetClose asChild>
              <Button asChild variant="outline">
                <Link href="/catalog">Бараа үзэх</Link>
              </Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="-mx-2 flex-1 space-y-4 overflow-y-auto px-2 py-4">
              {items.map((item) => (
                <div key={item.key} className="flex gap-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
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
                        <p className="text-xs text-muted-foreground">
                          {item.brand}
                        </p>
                        <p className="text-sm font-medium leading-tight">
                          {item.name}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
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
                        onClick={() => remove(item.key)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Устгах"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center rounded-md border border-border">
                        <button
                          className="px-2 py-1 hover:text-primary"
                          onClick={() => setQty(item.key, item.qty - 1)}
                          aria-label="Хасах"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-7 text-center text-sm">
                          {item.qty}
                        </span>
                        <button
                          className="px-2 py-1 hover:text-primary"
                          onClick={() => setQty(item.key, item.qty + 1)}
                          aria-label="Нэмэх"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPrice(item.unitPrice * item.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Дэд дүн</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <SheetClose asChild>
                <Button asChild className="w-full" size="lg">
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
