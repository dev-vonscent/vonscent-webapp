"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2, Check, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProductCard } from "@/features/products/components/product-card";
import { useWishlist } from "@/features/wishlist/store";
import { useCart } from "@/features/cart/store";
import { formatPrice } from "@/lib/format";
import type { ProductDetail, Variant } from "@/lib/types";

async function fetchDetails(ids: string[]): Promise<ProductDetail[]> {
  if (!ids.length) return [];
  const res = await fetch(`/api/products?ids=${ids.join(",")}&details=1`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items: ProductDetail[] };
  return data.items;
}

/** Cheapest active decant for a product (matches the "from …" display price). */
function cheapestVariant(p: ProductDetail): Variant | null {
  const active = p.variants.filter((v) => v.isActive);
  if (!active.length) return null;
  return active.reduce((a, b) => (b.price < a.price ? b : a));
}

export default function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const clearWishlist = useWishlist((s) => s.clear);
  const addToCart = useCart((s) => s.add);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist-details", ids],
    queryFn: () => fetchDetails(ids),
    enabled: mounted,
  });

  // Keep the original wishlist order (store ids drive the layout).
  const items = React.useMemo(() => {
    const map = new Map((data ?? []).map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter(Boolean) as ProductDetail[];
  }, [data, ids]);

  const inStock = items.filter((p) => !p.soldOut);
  const totalValue = inStock.reduce((sum, p) => sum + p.startingPrice, 0);

  const [confirmClear, setConfirmClear] = React.useState(false);
  const [addedAll, setAddedAll] = React.useState(false);
  React.useEffect(() => {
    if (!addedAll) return;
    const t = setTimeout(() => setAddedAll(false), 2500);
    return () => clearTimeout(t);
  }, [addedAll]);

  function addAllToCart() {
    let added = 0;
    for (const p of inStock) {
      const v = cheapestVariant(p);
      if (!v) continue;
      addToCart({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        variantId: v.id,
        ml: v.ml,
        unitPrice: v.price,
        image: p.image?.url ?? null,
      });
      added += 1;
    }
    if (added > 0) setAddedAll(true);
  }

  return (
    <div className="mx-auto max-w-[88rem] px-4 py-10 md:px-8">
      <h1 className="mb-6 hidden font-serif text-3xl font-semibold md:block">
        Хүслийн жагсаалт
      </h1>

      {!mounted || isLoading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-4 rounded-2xl border border-dashed py-24 text-center">
          <div className="bg-secondary flex size-16 items-center justify-center rounded-full">
            <Heart className="text-muted-foreground size-7" />
          </div>
          <div>
            <p className="font-medium">Жагсаалт хоосон байна</p>
            <p className="text-muted-foreground text-sm">
              Дуртай үнэртнээ ❤ дарж хадгалаарай.
            </p>
          </div>
          <Button asChild>
            <Link href="/catalog">Бараа үзэх</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Action bar — summary + bulk actions */}
          <div className="border-border bg-card mb-8 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-4">
              <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/10">
                <Heart className="size-5 fill-red-500 text-red-500" />
                <span className="bg-foreground text-background absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
                  {items.length}
                </span>
              </div>
              <div>
                <p className="leading-tight font-medium">
                  {items.length} бараа хадгалсан
                </p>
                <p className="text-muted-foreground text-sm">
                  Нийт{" "}
                  <span className="text-foreground font-semibold">
                    {formatPrice(totalValue)}
                  </span>
                  {items.length - inStock.length > 0 &&
                    ` · ${items.length - inStock.length} дууссан`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 max-sm:w-full">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 max-sm:flex-1"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="size-4" /> Цэвэрлэх
              </Button>
              <ConfirmDialog
                open={confirmClear}
                onOpenChange={setConfirmClear}
                title="Жагсаалтыг цэвэрлэх үү?"
                description="Хадгалсан бүх бараа устгагдана. Энэ үйлдлийг буцаах боломжгүй."
                confirmLabel="Цэвэрлэх"
                destructive
                onConfirm={clearWishlist}
              />
              {addedAll ? (
                <Button
                  asChild
                  size="sm"
                  className="gap-2 bg-white text-black hover:bg-white/90 max-sm:flex-1"
                >
                  <Link href="/cart">
                    <Check className="size-4" /> Сагсанд нэмлээ
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-2 bg-white text-black hover:bg-white/90 max-sm:flex-1"
                  onClick={addAllToCart}
                  disabled={inStock.length === 0}
                >
                  <ShoppingCart className="size-4" />
                  Бүгдийг сагслах
                  {inStock.length > 0 && (
                    <span className="opacity-75">({inStock.length})</span>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
