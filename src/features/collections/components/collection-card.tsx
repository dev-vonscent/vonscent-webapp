import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { GENDER_LABEL } from "@/lib/constants";
import type { Collection } from "../types";
import { formatDiscountRange } from "@/features/collections/pricing";

/** A bundle card: the poster image with the name and starting price over a
 * dark shade along its bottom edge. The poster already shows the four
 * bottles, so the card adds no member strip or shade over it. */
export function CollectionCard({ collection }: { collection: Collection }) {
  const start = collection.startingPrice;
  const startMl = collection.availableMls[0];

  return (
    <div className="group flex flex-col">
      <Link
        href={`/collections/${collection.slug}`}
        className="group-hover:shadow-lift bg-muted relative block aspect-square overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]"
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

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {collection.discountRange.max > 0 && (
            <Badge variant="sale" className="w-fit backdrop-blur-sm">
              −{formatDiscountRange(collection.discountRange)}
            </Badge>
          )}
        </div>

        {/* Мэдээлэл зурагны доод хэсэгт, доороос дээш бүдгэрэх хар
            gradient дээр — ямар ч өнгөтэй poster дээр цагаан текст
            уншигдана. Poster-ийн prompt савнуудын доор 30% зай үлдээдэг тул
            текст савыг халхлахгүй. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/75 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs leading-none tracking-[0.15em] text-white/75 uppercase">
              {GENDER_LABEL[collection.gender]}
            </span>
            <span className="block truncate font-serif text-xl/tight font-medium text-white">
              {collection.name}
            </span>
          </div>
          {/* «109,300₮» дангаараа «2ml нь 109,300₮» гэж уншигдана — доорх
              мөр нь тэр дүн юуны үнэ болохыг хэлнэ (үнэртний тоо × хэмжээ). */}
          {!collection.soldOut && start > 0 && (
            <span className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-base leading-none font-semibold tracking-tight text-white">
                {formatPrice(start)}-өөс
              </span>
              <span className="text-sm leading-none text-white/75">
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
