import Link from "next/link";
import Image from "next/image";
import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { GENDER_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Collection } from "../types";

/** A bundle card led by its poster image, with the member bottles as a small
 * avatar strip so the buyer still sees what's inside. */
export function CollectionCard({ collection }: { collection: Collection }) {
  const start = collection.startingPrice;
  const startMl = collection.availableMls[0];
  const members = collection.members.slice(0, 4);

  return (
    <div className="group flex flex-col">
      <Link
        href={`/collections/${collection.slug}`}
        className="border-border group-hover:border-gold-strong/40 group-hover:shadow-lift relative block aspect-3/2 overflow-hidden rounded-2xl border transition-all duration-300"
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
          {collection.discountPct > 0 && (
            <Badge variant="sale" className="w-fit backdrop-blur-sm">
              −{collection.discountPct}%
            </Badge>
          )}
          {collection.giftEnabled && (
            <Badge className="bg-foreground/85 text-background w-fit gap-1 backdrop-blur-sm">
              <Gift className="size-3" /> Бэлэгтэй
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
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center ">
            <span className="border-border bg-card rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
              Түр байхгүй
            </span>
          </div>
        )}
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">
            {GENDER_LABEL[collection.gender]}
          </span>
          <Link
            href={`/collections/${collection.slug}`}
            className="hover:text-gold-strong block truncate font-serif text-base/tight  font-medium transition-colors"
          >
            {collection.name}
          </Link>
        </div>
        {!collection.soldOut && start > 0 && (
          <span className="text-foreground/80 shrink-0 pt-0.5 text-sm font-semibold tracking-tight">
            {startMl}ml-ээс {formatPrice(start)}
          </span>
        )}
      </div>
    </div>
  );
}
