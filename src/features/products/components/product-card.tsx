import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { ProductListItem } from "@/lib/types";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import { QuickAdd } from "./quick-add";
import { GenderBadge } from "./gender-badge";
import { SaleBadge } from "@/features/sale-events/components/sale-badge";
import { SaleCountdown } from "./sale-countdown";

import { CARD_STATUS_LABEL, cardStatus, type CardStatus } from "../card-status";
import { salePctText } from "../sale";

export function ProductCard({
  product,
  matchPct,
  prefer,
  eager,
}: {
  product: ProductListItem;
  /** Quiz match percentage — shows a corner badge when set (3b). */
  matchPct?: number;
  /** Харж буй жагсаалтын төлөв түрүүлнэ (`cardStatus`). */
  prefer?: CardStatus[];
  /**
   * Эхний дэлгэцэнд харагдах карт (grid/rail-ийн эхний хэдэн нүд) — зураг нь
   * LCP болдог тул lazy биш, шууд татна.
   */
  eager?: boolean;
}) {
  const status = cardStatus(product, prefer);
  // «Тун удахгүй» (0125): «Дууссан» биш — ирэхийг хүлээж буй ус. Нүүрний
  // хэсэг, хүслийн жагсаалтад л гарна (каталог эдгээрийг алгасдаг).
  const comingSoon = product.comingSoon === true;
  const statusLabel = comingSoon
    ? "Тун удахгүй"
    : status && CARD_STATUS_LABEL[status];
  return (
    <div className="group relative flex flex-col">
      {/* touch-callout: iOS дээр удаан дарахад зургийг preview болгож
          харлуулдаг — гүйлгэх гэж хуруугаа тавихад ч идэвхждэг байв. */}
      <Link
        href={`/products/${product.slug}`}
        className="group-hover:shadow-lift relative aspect-4/5 overflow-hidden rounded-2xl bg-none transition-all duration-300 [-webkit-touch-callout:none]"
      >
        {product.image && (
          <Image
            src={product.image.url}
            alt={product.image.alt || product.name}
            fill
            loading={eager ? "eager" : undefined}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 280px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}
        {/* right-12: баруун дээд буланд зүрх/сагсны icon (size-8 + 10px) —
            «Black Friday ~30%» chip доогуур нь орж тасрахгүй. */}
        <div className="absolute top-2.5 right-12 left-2.5 flex flex-col items-start gap-1">
          {/* Нэг төлөв + хямдрал — хамгийн ихдээ хоёр badge. */}
          {statusLabel && (
            <Badge
              variant="outline"
              className="bg-background/85! w-fit border-transparent backdrop-blur-sm"
            >
              {statusLabel}
            </Badge>
          )}
          {/* «Black Friday» (арга хэмжээ, 0181) эсвэл «Хямдралтай». */}
          <SaleBadge
            productId={product.id}
            onSale={product.tags.includes("sale")}
            salePct={product.sale ? salePctText(product.sale) : undefined}
          />
        </div>
        {matchPct !== undefined && (
          <span className="bg-foreground text-background absolute bottom-2.5 left-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {matchPct}% тохирол
          </span>
        )}
        {product.soldOut && !comingSoon && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="bg-card rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Дууссан
            </span>
          </div>
        )}
      </Link>

      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
        <WishlistButton productId={product.id} />
        {!product.soldOut && !comingSoon && <QuickAdd product={product} />}
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
            {product.brand}
          </span>
          {/* Хүйсийн тэмдэг (backlog C1) — chip хэлбэрээр: дэвсгэр нь
              background-аас ялгарч, зүгээр текст мэт харагдахаа больно. */}
          <GenderBadge
            gender={product.gender}
            className="shrink-0 px-2 py-0.5 text-[10px] font-medium"
          />
        </div>
        <Link
          href={`/products/${product.slug}`}
          className="hover:text-gold-strong font-serif text-base/tight font-medium transition-colors"
        >
          {product.name}
        </Link>
        <CardPrice product={product} />
        {/* Хямдрал дуусах тоолуур (2.2, туг `sale_display`) — хугацаагүй
            хямдрал, дууссан бараанд гарахгүй. */}
        {!product.soldOut && (
          <SaleCountdown endsAt={product.sale?.endsAt} className="mt-0.5" />
        )}
      </div>
    </div>
  );
}

/**
 * Картын үнэ. Хамгийн хямд зарагдах хэмжээ хямдраагүй ч өөр хэмжээ
 * хямдарсан бол (task 2.5, `cardPrice`) тэр хамгийн жижиг хямдарсан
 * хэмжээний үнэ + зураастай үндсэн үнийг ХЭМЖЭЭТЭЙ нь: «5ml · 21,300₮
 * ~~25,000₮~~». Эс бөгөөс өмнөх шиг хамгийн бага үнэ.
 */
export function CardPrice({
  product,
}: {
  product: Pick<
    ProductListItem,
    "startingPrice" | "startingBasePrice" | "cardPrice"
  >;
}) {
  const card = product.cardPrice;
  const price = card ? card.price : product.startingPrice;
  const base = card ? card.basePrice : product.startingBasePrice;
  return (
    <span
      data-testid="card-price"
      className="text-foreground/70 mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold tracking-tight"
    >
      {card && (
        <span className="text-muted-foreground text-xs font-normal">
          {card.ml}ml ·
        </span>
      )}
      {formatPrice(price)}
      {/* Зөвхөн үндсэн үнэ (зураастай) — хувь нь chip дээр. */}
      {base > price && (
        <span className="text-muted-foreground text-xs font-normal line-through">
          {formatPrice(base)}
        </span>
      )}
    </span>
  );
}
