import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BOTTLE_KIND, bottleKind } from "../lib/bottle-kind";
import {
  bottleSizeText,
  eyebrowText,
  repeatsName,
  stockText,
} from "../lib/display";
import type { ShopExtraCard } from "../types";
import { BottleGlyph } from "./bottle-glyph";
import { categoryIcon } from "./category-icon";
import { ExtraQuickAdd } from "./extra-quick-add";

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
  quickAdd = false,
}: {
  extra: ShopExtraCard;
  /** Байхгүй бол (урьдчилан харах) холбоосгүй. */
  href?: string;
  className?: string;
  sizes?: string;
  /** Зураг дээрх «Сагсанд нэмэх» товч — үнэртний карттай ижил. */
  quickAdd?: boolean;
}) {
  const leftover = extra.leftover;
  const size = bottleSizeText(extra);
  const stock = stockText(extra);
  const perMl =
    leftover && leftover.remainingMl > 0
      ? Math.round(extra.fromPrice / leftover.remainingMl)
      : null;
  const eyebrow = eyebrowText(extra);
  // «ШПРИЦ / Шприц» — нэртэйгээ ижил ангиллыг давтахгүй. Мөр нь үлдэнэ:
  // эс бөгөөс grid-ийн мөрөнд нэр, үнэ хөрш картаасаа доогуур буудаг.
  const eyebrowRepeats = repeatsName(eyebrow, extra.name);

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
          <Placeholder extra={extra} icon={categoryIcon(extra.categorySlug)} />
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

      {quickAdd && href && !extra.soldOut && (
        <div className="absolute top-2.5 right-2.5">
          <ExtraQuickAdd extra={extra} />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-0.5">
        <span
          aria-hidden={eyebrowRepeats || undefined}
          className={cn(
            "text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase",
            eyebrowRepeats && "invisible",
          )}
        >
          {eyebrow}
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

/**
 * Зураггүй бараа: ангиллын дүрс том, нимгэн зураастай — жижиг `Package`
 * дүрс «зураг ачаалагдсангүй» мэт харагддаг байв. Шилэнд дүүргэлттэй дүрс.
 */
function Placeholder({
  extra,
  icon: Icon,
}: {
  extra: ShopExtraCard;
  icon: LucideIcon;
}) {
  const kind = bottleKind(extra.categorySlug, extra.mode);
  return (
    <span className="text-foreground/25 flex size-full items-center justify-center">
      {kind ? (
        <BottleGlyph fill={BOTTLE_KIND[kind].fill} className="h-20 w-15" />
      ) : (
        <Icon className="size-16" strokeWidth={1} aria-hidden />
      )}
    </span>
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
