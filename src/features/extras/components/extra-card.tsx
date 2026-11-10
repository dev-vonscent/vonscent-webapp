import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BOTTLE_KIND, bottleKind } from "../lib/bottle-kind";
import { BOTTLE_BADGE } from "../lib/sections";
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
  showKind = false,
  compact = false,
}: {
  extra: ShopExtraCard;
  /** Байхгүй бол (урьдчилан харах) холбоосгүй. */
  href?: string;
  className?: string;
  sizes?: string;
  /** Зураг дээрх «Сагсанд нэмэх» товч — үнэртний карттай ижил. */
  quickAdd?: boolean;
  /**
   * Шилний төрлийн badge («Бүтэн», «Хоосон») — төрөл холилдсон газарт
   * (нүүр, «Хамт авдаг»). «Үнэртний шил» хуудсанд tab нь төрлийг хэлдэг.
   */
  showKind?: boolean;
  /**
   * Үнэртний картаас жижиг (`/accessories` — цөөн, нэг дор олныг нь
   * харуулна): булан, зай, нэрийн үсэг багасна. Ангиллын eyebrow-гүй —
   * «Бэлгийн хайрцаг», «Шприц» гэх нэр нь өөрөө төрлөө хэлнэ.
   */
  compact?: boolean;
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
  const kind = bottleKind(extra.categorySlug, extra.mode);
  const badge = extra.soldOut
    ? null
    : showKind && kind
      ? BOTTLE_BADGE[kind]
      : leftover
        ? "Ганц ширхэг"
        : null;

  return (
    <div className={cn("group relative flex flex-col", className)}>
      {/* Нэрийн холбоостой ижил хаяг — гараар/screen reader-ээр нэг л удаа
          (зураггүй үед энэ холбоос нэргүй үлддэг байв). */}
      <MaybeLink
        href={href}
        decorative
        className={cn(
          "group-hover:shadow-lift bg-secondary relative block aspect-4/5 overflow-hidden transition-all duration-300 [-webkit-touch-callout:none]",
          compact ? "rounded-xl" : "rounded-2xl",
        )}
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
          <Placeholder
            extra={extra}
            icon={categoryIcon(extra.categorySlug)}
            compact={compact}
          />
        )}
        {badge && (
          <Badge
            variant="outline"
            className="bg-background/85! absolute top-2.5 left-2.5 w-fit border-transparent backdrop-blur-sm"
          >
            {badge}
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
        <div
          className={cn(
            "absolute",
            compact ? "top-1.5 right-1.5" : "top-2.5 right-2.5",
          )}
        >
          <ExtraQuickAdd extra={extra} />
        </div>
      )}

      <div className={cn("flex flex-col gap-0.5", compact ? "mt-2" : "mt-3")}>
        {!compact && (
          <span
            aria-hidden={eyebrowRepeats || undefined}
            className={cn(
              "text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase",
              eyebrowRepeats && "invisible",
            )}
          >
            {eyebrow}
          </span>
        )}
        <MaybeLink
          href={href}
          className={cn(
            "hover:text-gold-strong line-clamp-2 font-medium transition-colors",
            compact ? "text-sm/tight" : "text-base/tight",
          )}
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
  compact,
}: {
  extra: ShopExtraCard;
  icon: LucideIcon;
  compact: boolean;
}) {
  const kind = bottleKind(extra.categorySlug, extra.mode);
  return (
    <span className="text-foreground/25 flex size-full items-center justify-center">
      {kind ? (
        <BottleGlyph fill={BOTTLE_KIND[kind].fill} className="h-20 w-15" />
      ) : (
        <Icon
          className={compact ? "size-10" : "size-16"}
          strokeWidth={1}
          aria-hidden
        />
      )}
    </span>
  );
}

function MaybeLink({
  href,
  className,
  children,
  decorative = false,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
  /** Давхар холбоос — tab-аас, accessibility tree-ээс хасна (хулганаар дарагдана). */
  decorative?: boolean;
}) {
  return href ? (
    <Link
      href={href}
      className={className}
      tabIndex={decorative ? -1 : undefined}
      aria-hidden={decorative || undefined}
    >
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
