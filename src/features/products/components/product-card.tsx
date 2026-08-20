import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { ProductListItem } from "@/lib/types";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import { QuickAdd } from "./quick-add";

const TAG_LABEL: Record<string, string> = {
  new: "Шинэ",
  hot: "Эрэлттэй",
  sale: "Хямдрал",
};

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <div className="group relative flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="border-border bg-muted group-hover:border-gold-strong/40 group-hover:shadow-lift relative aspect-[4/5] overflow-hidden rounded-2xl border transition-all duration-300"
      >
        {product.image && (
          <Image
            src={product.image.url}
            alt={product.image.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1408px) 25vw, 324px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {product.tags.map((t) => (
            <Badge key={t} variant={t} className="w-fit backdrop-blur-sm">
              {TAG_LABEL[t]}
            </Badge>
          ))}
        </div>
        {product.soldOut && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="border-border bg-card rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Дууссан
            </span>
          </div>
        )}
      </Link>

      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
        <WishlistButton productId={product.id} />
        {!product.soldOut && <QuickAdd product={product} />}
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <span className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
          {product.brand}
        </span>
        <Link
          href={`/products/${product.slug}`}
          className="hover:text-primary font-serif text-base leading-tight font-medium transition-colors"
        >
          {product.name}
        </Link>
        <span className="text-foreground/70 mt-1.5 text-sm font-semibold tracking-tight">
          {formatPrice(product.startingPrice)}
        </span>
      </div>
    </div>
  );
}
