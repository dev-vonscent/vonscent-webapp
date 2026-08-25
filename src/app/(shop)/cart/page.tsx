"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Gift, Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { SHIPPING_ZONES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import { useCart, selectSubtotal } from "@/features/cart/store";
import { CartSizeSelect } from "@/features/cart/components/cart-size-select";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const collections = useCart((s) => s.collections);
  const setCollectionQty = useCart((s) => s.setCollectionQty);
  const removeCollection = useCart((s) => s.removeCollection);
  const subtotal = useCart(selectSubtotal);
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const [mounted, setMounted] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [couponMsg, setCouponMsg] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Estimated delivery fee — the admin's default (first deliverable) zone,
  // i.e. Ulaanbaatar city centre. Checkout still computes the real fee.
  const [defaultZoneFee, setDefaultZoneFee] = React.useState<number>(
    SHIPPING_ZONES[0].fee,
  );
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "shipping")
        .maybeSingle();
      const zones = (
        data as {
          value?: { zones?: { fee?: number; deliverable?: boolean }[] };
        } | null
      )?.value?.zones;
      const first = zones?.find((z) => z.deliverable !== false);
      if (first && Number(first.fee) > 0) setDefaultZoneFee(Number(first.fee));
    })();
  }, []);

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
    return <div className="mx-auto max-w-352 px-4 py-16 md:px-8" />;

  if (items.length === 0 && collections.length === 0) {
    return (
      <div className="mx-auto flex max-w-352 flex-col items-center gap-4 px-4 py-24 text-center md:px-8">
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

  return (
    <div className="mx-auto max-w-352 px-4 py-8 md:px-8">
      <h1 className="mb-8 font-serif text-3xl font-semibold">Таны сагс</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Bundles — one grouped card each (same grouping as the cart sheet) */}
          {collections.map((c) => (
            <Card key={c.key}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="border-border bg-muted relative size-24 shrink-0 overflow-hidden rounded-md border">
                    {c.image && (
                      <Image
                        src={c.image}
                        alt={c.name}
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
                          {c.type === "custom" ? "Custom багц" : "Багц"}
                        </p>
                        <p className="font-medium">{c.name}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-muted-foreground text-xs">
                            {c.ml}ml багц
                          </span>
                          {c.discountPct > 0 && (
                            <Badge variant="sale" className="h-4 px-1 text-[10px]">
                              −{c.discountPct}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCollection(c.key)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Устгах"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                      {c.members.map((m) => (
                        <li key={m.variantId} className="truncate">
                          • {m.brand} — {m.name}
                        </li>
                      ))}
                      {c.gift && (
                        <li className="text-foreground/80 flex items-center gap-1 truncate">
                          <Gift className="text-gold-strong size-3 shrink-0" />
                          Бэлэг: {c.gift.brand} — {c.gift.name} ({c.gift.ml}
                          ml)
                        </li>
                      )}
                    </ul>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="border-border flex items-center rounded-md border">
                        <button
                          className="hover:text-gold-strong px-2.5 py-1.5"
                          onClick={() => setCollectionQty(c.key, c.qty - 1)}
                          aria-label="Хасах"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm">{c.qty}</span>
                        <button
                          className="hover:text-gold-strong px-2.5 py-1.5"
                          onClick={() => setCollectionQty(c.key, c.qty + 1)}
                          aria-label="Нэмэх"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <span className="font-medium">
                        {formatPrice(c.unitPrice * c.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

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
                        className="hover:text-gold-strong font-medium"
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
                        className="hover:text-gold-strong px-2.5 py-1.5"
                        onClick={() => setQty(item.key, item.qty - 1)}
                        aria-label="Хасах"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm">
                        {item.qty}
                      </span>
                      <button
                        className="hover:text-gold-strong px-2.5 py-1.5"
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

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Хүргэлт · Улаанбаатар
                  </span>
                  <span className="font-medium">
                    {formatPrice(defaultZoneFee)}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Бүсээс хамаарна — эцсийн дүн checkout дээр.
                </p>
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
