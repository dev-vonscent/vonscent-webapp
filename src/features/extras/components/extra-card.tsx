import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bottleSizeText, stockText } from "../lib/display";
import type { ShopExtraCard } from "../types";

/**
 * Нэмэлт барааны карт — дэлгүүрийн жагсаалт ба админы «Дэлгүүрт ингэж
 * харагдана» урьдчилан харах ХОЁУЛАА энийг дуудна (нэг л хэлбэр).
 *
 * Үнэртний карттай нэг хэмнэлтэй: 4:5 зураг, жижиг том үсэгтэй ангилал,
 * serif нэр, намуухан үнэ. Үлдэгдэлтэй шил өөрийн мэдээлэлтэй: ганц ширхэг,
 * ойролцоо ml, 1ml-ийн үнэ — декантын үнэтэй харьцуулах суурь.
 */
export function ExtraCard({
  extra,
  href,
  className,
  sizes = "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: {
  extra: ShopExtraCard;
  /** Байхгүй бол (урьдчилан харах) холбоосгүй. */
  href?: string;
  className?: string;
  sizes?: string;
}) {
  const leftover = extra.leftover;
  const size = bottleSizeText(extra);
  const stock = stockText(extra);
  const perMl =
    leftover && leftover.remainingMl > 0
      ? Math.round(extra.fromPrice / leftover.remainingMl)
      : null;

  return (
    <div className={cn("group relative flex flex-col", className)}>
      <MaybeLink
        href={href}
        className="group-hover:shadow-lift bg-secondary relative block aspect-4/5 overflow-hidden rounded-2xl transition-all duration-300 [-webkit-touch-callout:none]"
      >
        {extra.image ? (
          <Image
            src={extra.image}
            alt={extra.name}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Package className="text-muted-foreground size-8" aria-hidden />
          </span>
        )}
        {leftover && !extra.soldOut && (
          <Badge
            variant="outline"
            className="bg-background/85! absolute top-2.5 left-2.5 w-fit border-transparent backdrop-blur-sm"
          >
            Ганц ширхэг
          </Badge>
        )}
        {extra.soldOut && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="bg-card rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
              {leftover ? "Зарагдсан" : "Дууссан"}
            </span>
          </div>
        )}
      </MaybeLink>

      <div className="mt-3 flex flex-col gap-0.5">
        <span className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
          {leftover ? leftover.brand : extra.categoryName}
        </span>
        <MaybeLink
          href={href}
          className="hover:text-gold-strong line-clamp-2 font-serif text-base/tight font-medium transition-colors"
        >
          {extra.name}
        </MaybeLink>
        {leftover && (
          <span className="text-muted-foreground text-xs tabular-nums">
            ≈{leftover.remainingMl} / {leftover.fullMl}ml
            {perMl != null && ` · 1ml ≈ ${formatPrice(perMl)}`}
          </span>
        )}
        {(size || (stock && !extra.soldOut)) && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {[size, extra.soldOut ? null : stock].filter(Boolean).join(" · ")}
          </span>
        )}
        <span className="text-foreground/70 mt-1.5 text-sm font-semibold tracking-tight whitespace-nowrap">
          {/* Үнэртний карттай ижил: «эхлэх» үнэ үгүйгээр — хувилбар нь
              барааны хуудсанд. */}
          {formatPrice(extra.fromPrice)}
        </span>
      </div>
    </div>
  );
}

function MaybeLink({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
