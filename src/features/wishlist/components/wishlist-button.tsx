"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/features/wishlist/store";

export function WishlistButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const ids = useWishlist((s) => s.ids);
  const toggle = useWishlist((s) => s.toggle);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = mounted && ids.includes(productId);

  return (
    <button
      type="button"
      aria-label="Хүслийн жагсаалтад нэмэх"
      aria-pressed={active}
      onClick={() => toggle(productId)}
      className={cn(
        "bg-background/80 text-foreground hover:bg-background flex size-8 items-center justify-center rounded-full backdrop-blur transition-colors relative before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2  before:content-['']",
        className,
      )}
    >
      <Heart className={cn("size-4", active && "fill-red-500 text-red-500")} />
    </button>
  );
}
