"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/features/wishlist/store";

/**
 * ❤ товч — ус (`productId`) эсвэл бэлэн багц (`collectionId`, 0107).
 * Хоёр нь store-д тусдаа жагсаалт (`ids` / `collectionIds`).
 */
export function WishlistButton({
  productId,
  collectionId,
  className,
}: {
  className?: string;
} & (
  | { productId: string; collectionId?: never }
  | { collectionId: string; productId?: never }
)) {
  const isCollection = collectionId != null;
  const id = (collectionId ?? productId) as string;
  const list = useWishlist((s) =>
    isCollection ? (s.collectionIds ?? []) : s.ids,
  );
  const toggleProduct = useWishlist((s) => s.toggle);
  const toggleCollection = useWishlist((s) => s.toggleCollection);
  const toggle = isCollection ? toggleCollection : toggleProduct;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = mounted && list.includes(id);

  return (
    <button
      type="button"
      aria-label="Хүслийн жагсаалтад нэмэх"
      aria-pressed={active}
      onClick={() => toggle(id)}
      className={cn(
        "bg-background/80 text-foreground hover:bg-background relative flex size-8 items-center justify-center rounded-full backdrop-blur transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']",
        className,
      )}
    >
      <Heart className={cn("size-4", active && "fill-red-500 text-red-500")} />
    </button>
  );
}
