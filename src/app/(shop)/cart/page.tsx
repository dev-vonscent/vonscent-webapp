"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Gift, Minus, Plus, Trash2, Truck, ShoppingCart } from "lucide-react";
import { bundleGiftGuarantee } from "@/lib/gift";
import { useGiftPool } from "@/features/gifts/use-gift-pool";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatPrice } from "@/lib/format";
import { useCart, selectSubtotal } from "@/features/cart/store";
import { CartSizeSelect } from "@/features/cart/components/cart-size-select";
import { useCartSelection } from "@/features/cart/use-cart-selection";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const collections = useCart((s) => s.collections);
  const setCollectionQty = useCart((s) => s.setCollectionQty);
  const removeCollection = useCart((s) => s.removeCollection);
  const giftPool = useGiftPool();
  const setItemSelected = useCart((s) => s.setItemSelected);
  const setCollectionSelected = useCart((s) => s.setCollectionSelected);
  const {
    isItemSelected,
    isCollectionSelected,
    setAllSelected,
    removeSelected,
    lineCount,
    selectedLineCount,
    allSelected,
    noneSelected,
  } = useCartSelection();
  // Устгах нь буцаагдахгүй тул нэг дарааж баталгаажуулна.
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const subtotal = useCart(selectSubtotal);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="mx-auto max-w-352 px-4 py-16 md:px-8" />;

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
          {/* Сонголтын толгой мөр — хүссэн барааг л захиалах боломж */}
          <div className="flex items-center justify-between gap-3 px-1">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => setAllSelected(Boolean(v))}
                aria-label="Бүгдийг сонгох"
              />
              <span>Бүгдийг сонгох</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {selectedLineCount}/{lineCount}
              </span>
            </label>
            {/* Мөр бүр аль хэдийн хогийн савны icon-той тул толгойн үйлдлийг
                ч icon болговол «энэ мөрийг устгах» гэж уншигдана — текст
                товч нь хэмжээгээрээ ч, үгээрээ ч өөр зүйл гэдгийг хэлнэ. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              disabled={noneSelected}
              className="text-muted-foreground hover:text-destructive -mr-2 h-11 text-xs md:h-9"
            >
              Сонгосныг устгах
            </Button>
          </div>

          {/* Bundles — one grouped card each (same grouping as the cart sheet) */}
          {collections.map((c) => (
            <Card key={c.key}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Checkbox
                    checked={isCollectionSelected(c.key)}
                    onCheckedChange={(v) =>
                      setCollectionSelected(c.key, Boolean(v))
                    }
                    aria-label={`${c.name} багцыг сонгох`}
                    className="mt-1 self-start"
                  />
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
                    <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                      {c.members.map((m) => (
                        <li key={m.variantId} className="truncate">
                          • {m.brand} — {m.name}
                        </li>
                      ))}
                      {giftPool?.enabled && bundleGiftGuarantee(c) > 0 && (
                        <li className="text-foreground/80 flex items-center gap-1">
                          <Gift className="text-gold-strong size-3 shrink-0" />
                          1мл бэлгийн эрхтэй — бэлгээ төлбөрийн хуудсанд сонгоно
                        </li>
                      )}
                    </ul>
                    <div className="mt-auto flex items-center justify-between pt-2">
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
                <Checkbox
                  checked={isItemSelected(item.key)}
                  onCheckedChange={(v) => setItemSelected(item.key, Boolean(v))}
                  aria-label={`${item.name} сонгох`}
                  className="mt-1 self-start"
                />
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
                {/* Сонгосон мөрийн тоо зүүн талын «Бүгдийг сонгох 2/2»-д
                    аль хэдийн байгаа тул энд давхардуулахгүй. */}
                <span className="text-muted-foreground">Барааны дүн</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>

              {/*
                Хүргэлтийн төлбөрийг тоогоор бичихгүй — хаягийн бүсээс
                хамаарч хэлбэлздэг тул «8,000₮» гэж амлаад дараа нь өөр дүн
                гарах нь хэрэглэгчийн хамгийн таагүй хүлээж авдаг зөрүү.
                Тиймээс сагс нь барааны дүнгээ л баттай хэлж, хүргэлтийг
                хаяг тодорсны дараа (checkout) нэмнэ — сагсны sheet ч мөн
                ийм.

                Купоны талбар ч энд байхгүй — зориуд: код байхгүй хүнд «хаа
                нэгтээ хямдрал байна» гэж хэлээд сайтаас гаргаж купон
                хайлгадаг (Baymard), мөн checkout дээр хэрэглэгчийн боломжтой
                купоныг өөрөө санал болгодог хувилбар аль хэдийн бий.
              */}
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Truck className="size-4" /> Хүргэлт
                </span>
                <span className="text-sm">Хаягаас хамаарна</span>
              </div>
              <p className="text-muted-foreground text-xs text-balance">
                Хүргэлтийн төлбөр, купон, V point бүгд дараагийн хуудсанд —
                хаягаа сонгомогц эцсийн дүн гарна.
              </p>
              <Button
                asChild={!noneSelected}
                size="lg"
                className="w-full"
                disabled={noneSelected}
              >
                {noneSelected ? (
                  "Захиалах бараагаа сонгоно уу"
                ) : (
                  <Link href="/checkout">Захиалга үргэлжлүүлэх</Link>
                )}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/catalog">Үргэлжлүүлэн дэлгүүр хэсэх</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Сонгосон мөрүүдийг устгах нь буцаагдахгүй тул нэг баталгаажуулалт —
          сагсны толгойн дээрх хогийн савны icon үүнийг нээнэ. */}
      <ResponsiveDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Сонгосон барааг устгах?"
        description={`Сагснаас ${selectedLineCount} мөр устана. Үүнийг буцаах боломжгүй.`}
      >
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setConfirmRemove(false)}>
            Болих
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              removeSelected();
              setConfirmRemove(false);
            }}
          >
            Устгах
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
