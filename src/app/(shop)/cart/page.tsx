"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { FREE_SHIP_OVER } from "@/lib/constants";
import { useCart, selectSubtotal } from "@/features/cart/store";
import { CartSizeSelect } from "@/features/cart/components/cart-size-select";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart(selectSubtotal);
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const [mounted, setMounted] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [couponMsg, setCouponMsg] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCoupon({
          code: data.code ?? code.trim().toUpperCase(),
          discount: data.discount,
        });
        setCouponMsg(null);
        setCode("");
      } else {
        setCoupon(null);
        setCouponMsg(data.message ?? "Купон хүчингүй байна.");
      }
    } catch {
      setCouponMsg("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setApplying(false);
    }
  }

  if (!mounted)
    return <div className="mx-auto max-w-[88rem] px-4 py-16 md:px-8" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[88rem] flex-col items-center gap-4 px-4 py-24 text-center md:px-8">
        <ShoppingCart className="text-muted-foreground size-12" />
        <h1 className="font-serif text-2xl font-semibold">Сагс хоосон байна</h1>
        <p className="text-muted-foreground">
          Дуртай үнэртнээ сонгож сагсандаа нэмээрэй.
        </p>
        <Button asChild size="lg">
          <Link href="/catalog">Бараа үзэх</Link>
        </Button>
      </div>
    );
  }

  const remaining = FREE_SHIP_OVER - subtotal;

  return (
    <div className="mx-auto max-w-[88rem] px-4 py-8 md:px-8">
      <h1 className="mb-8 font-serif text-3xl font-semibold">Таны сагс</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.key}>
              <CardContent className="flex gap-4 p-4">
                <div className="border-border bg-muted relative size-24 shrink-0 overflow-hidden rounded-md border">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase">
                        {item.brand}
                      </p>
                      <Link
                        href={`/products/${item.slug}`}
                        className="hover:text-primary font-medium"
                      >
                        {item.name}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-2">
                        <CartSizeSelect
                          itemKey={item.key}
                          slug={item.slug}
                          variantId={item.variantId}
                          ml={item.ml}
                          className="h-8 w-36 text-xs"
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
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="border-border flex items-center rounded-md border">
                      <button
                        className="hover:text-primary px-2.5 py-1.5"
                        onClick={() => setQty(item.key, item.qty - 1)}
                        aria-label="Хасах"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm">
                        {item.qty}
                      </span>
                      <button
                        className="hover:text-primary px-2.5 py-1.5"
                        onClick={() => setQty(item.key, item.qty + 1)}
                        aria-label="Нэмэх"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="font-medium">
                      {formatPrice(item.unitPrice * item.qty)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:h-fit">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-serif text-lg font-semibold">
                Захиалгын дүн
              </h2>
              {remaining > 0 && (
                <p className="bg-secondary text-secondary-foreground rounded-md px-3 py-2 text-xs">
                  {formatPrice(remaining)}-н бараа нэмбэл хүргэлт{" "}
                  <strong>үнэгүй</strong>.
                </p>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Дэд дүн</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>

              {/* Coupon */}
              {coupon ? (
                <div className="bg-secondary flex items-center justify-between rounded-md px-3 py-2 text-sm">
                  <span>
                    Купон <strong>{coupon.code}</strong>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-success font-medium">
                      −{formatPrice(Math.min(coupon.discount, subtotal))}
                    </span>
                    <button
                      onClick={() => setCoupon(null)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Купон хасах"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              ) : (
                <form onSubmit={applyCoupon} className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Купон код"
                    className="h-9"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={applying}
                  >
                    {applying ? "…" : "Хэрэглэх"}
                  </Button>
                </form>
              )}
              {couponMsg && (
                <p className="text-destructive text-xs">{couponMsg}</p>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Хүргэлт</span>
                <span className="text-muted-foreground">
                  Checkout дээр тооцно
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Нийт</span>
                <span className="font-serif text-lg font-semibold">
                  {formatPrice(
                    subtotal -
                      (coupon ? Math.min(coupon.discount, subtotal) : 0),
                  )}
                </span>
              </div>
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout">Захиалга үргэлжлүүлэх</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/catalog">Үргэлжлүүлэн дэлгүүр хэсэх</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
