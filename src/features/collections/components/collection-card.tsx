import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { GENDER_LABEL } from "@/lib/constants";
import type { Collection } from "../types";
import { formatDiscountRange } from "@/features/collections/pricing";
import { GenderBadge } from "@/features/products/components/gender-badge";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import { CollectionQuickAdd } from "./collection-quick-add";

import {
  CARD_STATUS_LABEL,
  cardStatus,
  type CardStatus,
} from "@/features/products/card-status";

/** A bundle card: the poster image with the name and starting price over a
 * dark shade along its bottom edge. The poster already shows the four
 * bottles, so the card adds no member strip or shade over it. */
export function CollectionCard({
  collection,
  variant = "overlay",
  prefer,
}: {
  collection: Collection;
  /** `rail` — нүүрний rail-д барааны card-тай ижил: мэдээлэл зурагны доор. */
  variant?: "overlay" | "rail";
  /** `rail` variant: харж буй жагсаалтын төлөв түрүүлнэ (`cardStatus`). */
  prefer?: CardStatus[];
}) {
  if (variant === "rail")
    return <RailCollectionCard collection={collection} prefer={prefer} />;
  const start = collection.startingPrice;
  const startMl = collection.availableMls[0];

  return (
    <div className="group flex flex-col">
      <Link
        href={`/collections/${collection.slug}`}
        className="group-hover:shadow-lift bg-muted relative block aspect-4/5 overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]"
      >
        {collection.image && (
          <Image
            src={collection.image}
            alt={collection.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1408px) 25vw, 324px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {collection.discountRange.max > 0 && (
            <Badge
              variant="sale"
              className="bg-background/85! w-fit backdrop-blur-sm"
            >
              −{formatDiscountRange(collection.discountRange)}
            </Badge>
          )}
        </div>

        {/* Мэдээлэл зурагны доод хэсэгт, доороос дээш бүдгэрэх хар
            gradient дээр — ямар ч өнгөтэй poster дээр цагаан текст
            уншигдана. Poster-ийн prompt савнуудын доор 30% зай үлдээдэг тул
            текст савыг халхлахгүй. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/75 via-black/30 to-transparent" />
        {/* Card нь барааны card шиг нарийн (утсан дээр 2 багана) тул нэр,
            үнэ хоёр хажуу биш, дээрээс доош давхарлана. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 sm:p-4">
          <span className="text-[11px] leading-none tracking-[0.15em] text-white/75 uppercase sm:text-xs">
            {GENDER_LABEL[collection.gender]}
          </span>
          <span className="block truncate font-serif text-base/tight font-medium text-white sm:text-xl/tight">
            {collection.name}
          </span>
          {/* «109,300₮» дангаараа «2ml нь 109,300₮» гэж уншигдана — хажуух
              хэсэг нь тэр дүн юуны үнэ болохыг хэлнэ (үнэртний тоо × хэмжээ). */}
          {!collection.soldOut && start > 0 && (
            <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="text-sm leading-none font-semibold tracking-tight text-white sm:text-base">
                {formatPrice(start)}-өөс
              </span>
              <span className="text-xs leading-none text-white/75 sm:text-sm">
                {collection.members.length} × {startMl}ml
              </span>
            </span>
          )}
        </div>

        {collection.soldOut && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="bg-card rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Түр байхгүй
            </span>
          </div>
        )}
      </Link>
    </div>
  );
}

/**
 * Нүүрний rail-д ус, багц холилдоно — багцын card барааны card-ын
 * (`ProductCard`) бүтцийг давтана: зураг дээр зөвхөн badge ба зүрх, доор нь
 * «Багц» шошго + хүйс, нэр, үнэ. Ингэснээр мөрөнд нэг хэмнэлтэй харагдана.
 */
function RailCollectionCard({
  collection,
  prefer,
}: {
  collection: Collection;
  prefer?: CardStatus[];
}) {
  const start = collection.startingPrice;
  const startMl = collection.availableMls[0];
  const href = `/collections/${collection.slug}`;
  const status = cardStatus(collection, prefer);

  return (
    <div className="group relative flex flex-col">
      <Link
        href={href}
        className="group-hover:shadow-lift bg-muted relative aspect-4/5 overflow-hidden rounded-2xl transition-all duration-300 [-webkit-touch-callout:none]"
      >
        {collection.image && (
          <Image
            src={collection.image}
            alt={collection.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1408px) 25vw, 324px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}
        {/* Барааны card шиг: нэг төлөв + хөнгөлөлт — хамгийн ихдээ хоёр. */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {status && (
            <Badge
              variant="outline"
              className="bg-background/85! w-fit border-transparent backdrop-blur-sm"
            >
              {CARD_STATUS_LABEL[status]}
            </Badge>
          )}
          {collection.discountRange.max > 0 && (
            <Badge
              variant="sale"
              className="bg-background/85! w-fit backdrop-blur-sm"
            >
              −{formatDiscountRange(collection.discountRange)}
            </Badge>
          )}
        </div>
        {collection.soldOut && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="bg-card rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Түр байхгүй
            </span>
          </div>
        )}
      </Link>

      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
        <WishlistButton collectionId={collection.id} />
        {!collection.soldOut && <CollectionQuickAdd collection={collection} />}
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
            Багц
          </span>
          <GenderBadge
            gender={collection.gender}
            className="ring-foreground/10 shrink-0 px-2 py-0.5 text-[10px] font-medium ring-1"
          />
        </div>
        <Link
          href={href}
          className="hover:text-gold-strong font-serif text-base/tight font-medium transition-colors"
        >
          {collection.name}
        </Link>
        {/* «-өөс» ба «4 × 2ml» — тэр дүн хамгийн бага хэмжээний бүтэн багцын
            үнэ гэдгийг хэлнэ. */}
        {!collection.soldOut && start > 0 && (
          <span className="text-foreground/70 mt-1.5 flex items-baseline gap-1.5 text-sm font-semibold tracking-tight">
            {formatPrice(start)}-өөс
            <span className="text-muted-foreground text-xs font-normal">
              {collection.members.length} × {startMl}ml
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
