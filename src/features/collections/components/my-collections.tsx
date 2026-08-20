"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { GiftPicker } from "./gift-picker";
import type { Collection, GiftCandidate } from "../types";

function Card({
  collection,
  giftCandidates,
  giftEnabled,
  giftMl,
}: {
  collection: Collection;
  giftCandidates: GiftCandidate[];
  giftEnabled: boolean;
  giftMl: number;
}) {
  const router = useRouter();
  const addCollection = useCart((s) => s.addCollection);
  const [ml, setMl] = React.useState<number>(
    collection.availableMls[0] ?? collection.prices[0]?.ml,
  );
  const [giftId, setGiftId] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(collection.name);
  const [confirmDel, setConfirmDel] = React.useState(false);

  const priceRow = collection.prices.find((p) => p.ml === ml) ?? null;
  const available = priceRow?.available ?? false;
  const memberIds = new Set(collection.members.map((m) => m.productId));
  const candidates = giftCandidates.filter((g) => !memberIds.has(g.productId));
  const gift = candidates.find((g) => g.productId === giftId) ?? null;
  const needsGift = giftEnabled && candidates.length > 0 && !giftId;

  function add() {
    if (!priceRow || !available || needsGift) return;
    addCollection({
      collectionId: collection.id,
      type: "custom",
      slug: collection.slug,
      name: collection.name,
      image: collection.image,
      discountPct: collection.discountPct,
      ml,
      members: collection.members.map((m) => ({
        productId: m.productId,
        variantId: m.variantByMl[ml].variantId,
        slug: m.slug,
        name: m.name,
        brand: m.brand,
        image: m.image?.url ?? null,
        price: m.variantByMl[ml].price,
      })),
      gift: gift
        ? {
            productId: gift.productId,
            name: gift.name,
            brand: gift.brand,
            image: gift.image?.url ?? null,
            ml: giftMl,
          }
        : null,
      unitPrice: priceRow.price,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  async function rename() {
    await fetch(`/api/collections/mine/${collection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    }).catch(() => {});
    setRenaming(false);
    router.refresh();
  }

  async function remove() {
    await fetch(`/api/collections/mine/${collection.id}`, {
      method: "DELETE",
    }).catch(() => {});
    router.refresh();
  }

  return (
    <div className="border-border bg-card rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <div className="border-border bg-muted relative size-20 shrink-0 overflow-hidden rounded-lg border">
          {collection.image && (
            <Image
              src={collection.image}
              alt={collection.name}
              fill
              sizes="80px"
              className="object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8"
              />
              <Button size="sm" onClick={rename}>
                Хадгалах
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-medium">
                {collection.name}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setName(collection.name);
                    setRenaming(true);
                  }}
                  className="text-muted-foreground hover:text-foreground p-1"
                  aria-label="Нэр солих"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => (confirmDel ? remove() : setConfirmDel(true))}
                  onBlur={() => setConfirmDel(false)}
                  className={cn(
                    "p-1",
                    confirmDel
                      ? "text-destructive"
                      : "text-muted-foreground hover:text-destructive",
                  )}
                  aria-label="Устгах"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          )}
          <p className="text-muted-foreground mt-0.5 text-xs">
            {collection.members.map((m) => m.name).join(" · ")}
          </p>
        </div>
      </div>

      {collection.soldOut ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Багцын зарим үнэртэн одоогоор байхгүй байна.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            {collection.prices.map((p) => (
              <button
                key={p.ml}
                onClick={() => setMl(p.ml)}
                disabled={!p.available}
                aria-pressed={p.ml === ml}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  !p.available
                    ? "text-muted-foreground cursor-not-allowed line-through opacity-50"
                    : p.ml === ml
                      ? "bg-foreground text-background"
                      : "bg-secondary hover:bg-accent",
                )}
              >
                {p.ml}ml
              </button>
            ))}
            <span className="ml-auto text-sm font-semibold">
              {formatPrice(priceRow?.price ?? 0)}
            </span>
          </div>

          {giftEnabled && candidates.length > 0 && (
            <GiftPicker
              candidates={candidates}
              giftMl={giftMl}
              value={giftId}
              onChange={setGiftId}
            />
          )}

          <Button
            size="sm"
            className="w-full"
            disabled={!available || needsGift}
            onClick={add}
          >
            {added ? (
              <>
                <Check className="size-4" /> Нэмэгдлээ
              </>
            ) : needsGift ? (
              "Бэлгээ сонгоно уу"
            ) : (
              <>
                <ShoppingCart className="size-4" /> Сагсанд нэмэх
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function MyCollections({
  collections,
  giftCandidates,
  giftEnabled,
  giftMl,
}: {
  collections: Collection[];
  giftCandidates: GiftCandidate[];
  giftEnabled: boolean;
  giftMl: number;
}) {
  if (collections.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-4 rounded-2xl border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Хадгалсан багц алга байна.
        </p>
        <Button asChild>
          <Link href="/collections/build">Багц угсрах</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {collections.map((c) => (
        <Card
          key={c.id}
          collection={c}
          giftCandidates={giftCandidates}
          giftEnabled={giftEnabled}
          giftMl={giftMl}
        />
      ))}
    </div>
  );
}
