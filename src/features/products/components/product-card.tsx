import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { ProductListItem } from "@/lib/types";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import { QuickAdd } from "./quick-add";
import { GenderBadge } from "./gender-badge";

const TAG_LABEL: Record<string, string> = {
  new: "Шинэ",
  hot: "Эрэлттэй",
  sale: "Хямдрал",
};

export function ProductCard({
  product,
  matchPct,
}: {
  product: ProductListItem;
  /** Quiz match percentage — shows a corner badge when set (3b). */
  matchPct?: number;
}) {
  return (
    <div className="group relative flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="group-hover:shadow-lift relative aspect-4/5 overflow-hidden rounded-2xl bg-none transition-all duration-300"
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
            <Badge
              key={t}
              variant={t}
              className="bg-background/85! w-fit backdrop-blur-sm"
            >
              {TAG_LABEL[t]}
            </Badge>
          ))}
        </div>
        {matchPct !== undefined && (
          <span className="bg-foreground text-background absolute bottom-2.5 left-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {matchPct}% тохирол
          </span>
        )}
        {product.soldOut && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="bg-card rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
            {product.brand}
          </span>
          {/* Хүйсийн тэмдэг (backlog C1) — брэндийн мөрөнд, чимээгүй. */}
          <GenderBadge gender={product.gender} tone="muted" />
        </div>
        <Link
          href={`/products/${product.slug}`}
          className="hover:text-gold-strong font-serif text-base/tight font-medium transition-colors"
        >
          {product.name}
        </Link>
        <span className="text-foreground/70 mt-1.5 flex items-baseline gap-1.5 text-sm font-semibold tracking-tight">
          {formatPrice(product.startingPrice)}
          {/* Зөвхөн үндсэн үнэ (зураастай) — хувь харуулахгүй (backlog B4). */}
          {product.startingBasePrice > product.startingPrice && (
            <span className="text-muted-foreground text-xs font-normal line-through">
              {formatPrice(product.startingBasePrice)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
