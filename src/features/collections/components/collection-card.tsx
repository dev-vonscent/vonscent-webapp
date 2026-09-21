import Link from "next/link";
import Image from "next/image";
import { Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { GENDER_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Collection } from "../types";
import {
  formatDiscountRange,
  giftBadgeLabel,
} from "@/features/collections/pricing";

/** A bundle card led by its poster image, with the member bottles as a small
 * avatar strip so the buyer still sees what's inside. */
export function CollectionCard({
  collection,
  giftPoolEnabled = false,
}: {
  collection: Collection;
  /** Бэлгийн сан идэвхтэй үед л дээжийн тэмдэг гарна (backlog A2). */
  giftPoolEnabled?: boolean;
}) {
  const start = collection.startingPrice;
  const startMl = collection.availableMls[0];
  const members = collection.members.slice(0, 4);
  const giftLabel = giftPoolEnabled ? giftBadgeLabel(collection) : null;

  return (
    <div className="group flex flex-col">
      <Link
        href={`/collections/${collection.slug}`}
        className="group-hover:shadow-lift relative block aspect-3/2 overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]"
      >
        {collection.image && (
          <Image
            src={collection.image}
            alt={collection.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/65 via-black/5 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {collection.discountRange.max > 0 && (
            <Badge variant="sale" className="w-fit backdrop-blur-sm">
              −{formatDiscountRange(collection.discountRange)}
            </Badge>
          )}
          {giftLabel && (
            <Badge className="bg-foreground/85 text-background w-fit gap-1 backdrop-blur-sm">
              <Droplet className="size-3" /> {giftLabel}
            </Badge>
          )}
        </div>

        {/* Member bottles peeking at the bottom of the poster */}
        <div className="absolute bottom-3 left-3 flex items-center">
          {members.map((m, i) => (
            <span
              key={m.productId}
              className={cn(
                "border-background/80 bg-muted relative size-8 overflow-hidden rounded-full border-2 shadow-sm",
                i > 0 && "-ml-2.5",
              )}
              style={{ zIndex: members.length - i }}
            >
              {m.image && (
                <Image
                  src={m.image.url}
                  alt={m.name}
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              )}
            </span>
          ))}
          <span className="ml-2 text-xs font-medium text-white/90">
            {collection.members.length} үнэртэн
          </span>
        </div>

        {collection.soldOut && (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center">
            <span className="bg-card rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Түр байхгүй
            </span>
          </div>
        )}
      </Link>

      {/* Хоёр багана хоёулаа «жижиг шошго → гол мөр» бүтэцтэй тул мөр
          хоорондын зай нь хоёуланд нь ижил байх ёстой: `leading-none` дээр
          flex gap нэмж зайг нүдээр биш, тоогоор тэнцүүлнэ (нэрийн мөр нь
          `truncate`-тай учир доод уртыг нь хайчлахгүйн тулд `tight`, түүний
          2px-ийг баруун баганын gap-аас нөхнө). */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground text-[11px] leading-none tracking-[0.15em] uppercase">
            {GENDER_LABEL[collection.gender]}
          </span>
          <Link
            href={`/collections/${collection.slug}`}
            className="hover:text-gold-strong block truncate font-serif text-base/tight font-medium transition-colors"
          >
            {collection.name}
          </Link>
        </div>
        {/* «109,300₮» дангаараа «2ml нь 109,300₮» гэж уншигдана — доорх мөр
            нь тэр дүн юуны үнэ болохыг хэлнэ (үнэртний тоо × хэмжээ). */}
        {!collection.soldOut && start > 0 && (
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-foreground/80 text-sm leading-none font-semibold tracking-tight">
              {formatPrice(start)}-өөс
            </span>
            <span className="text-muted-foreground text-xs leading-none">
              {collection.members.length} × {startMl}ml
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
