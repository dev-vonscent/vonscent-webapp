"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useGiftPicks } from "../gift-picks";
import { BOTTLE_KIND, bottleKind } from "../lib/bottle-kind";
import { bottleSizeText } from "../lib/display";
import type { ShopExtraCard, ShopExtraDetail } from "../types";
import { GiftTile, giftLine, giftOffers, type GiftOffer } from "./gift-tile";

/**
 * Үнэртний хуудасны нэмэлт бараа (extras-shop-plan §9, §19.4):
 *   · «Шилээр нь авах» — тухайн үнэртний бүтэн / үлдэгдэлтэй / хоосон шил
 *     (шилний хуудасны «Грамаар авах»-ын эсрэг тал).
 *     Утсан дээр шилийг олох хамгийн богино зам: «Sauvage» хайсан хүн
 *     «Үнэртний шил» хуудсанд дахин хайхгүй.
 *   · «Бэлэглэх бол» — бүх бэлгийн сав (хайрцаг, уут) сонголтоор. Сонголт нь
 *     сагсанд шууд биш: «Сагсанд нэмэх» / «Захиалах» дарахад үнэртэнтэй
 *     хамт 1 ширхэгээр явна (`useGiftPicks`).
 * Туг хаалттай үед сервер юу ч дамжуулахгүй тул энэ хэсэг гарахгүй.
 */
export function ProductExtras({
  gifts,
  bottles,
}: {
  gifts: ShopExtraDetail[];
  bottles: ShopExtraCard[];
}) {
  const forSale = bottles.filter((b) => !b.soldOut);
  const offers = giftOffers(gifts);
  // Өөр хуудас руу гарахад сонголт дагаж явахгүй.
  const reset = useGiftPicks((s) => s.reset);
  React.useEffect(() => reset, [reset]);
  if (forSale.length === 0 && offers.length === 0) return null;

  return (
    <div className="space-y-5">
      <BottleList
        id="product-bottles"
        title="Шилээр нь авах"
        bottles={bottles}
      />
      {offers.length > 0 && (
        <section aria-labelledby="product-gifts" className="space-y-1.5">
          <h2 id="product-gifts" className={EYEBROW}>
            Бэлэглэх бол
          </h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {offers.map((o) => (
              <li key={o.gift.card.id}>
                <GiftOption offer={o} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Нэг үнэртний шилнүүд (зарагдаж буй) мөрөөр — үнэртний хуудасны «Шилээр нь
 * авах», шилний хуудасны «Энэ үнэрийн бусад шил» хоёулаа (нэг хэлбэр).
 */
export function BottleList({
  id,
  title,
  bottles,
}: {
  id: string;
  title: string;
  bottles: ShopExtraCard[];
}) {
  const forSale = bottles.filter((b) => !b.soldOut);
  if (forSale.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <h2 id={id} className={EYEBROW}>
        {title}
      </h2>
      <ul className="bg-secondary divide-border divide-y overflow-hidden rounded-xl">
        {forSale.map((b) => (
          <li key={b.id}>
            <BottleRow bottle={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const EYEBROW =
  "text-muted-foreground text-xs font-medium tracking-wide uppercase";

/** Нэг бэлгийн сав — сонголт нь `useGiftPicks`-д (сагсанд шууд биш). */
function GiftOption({ offer }: { offer: GiftOffer }) {
  const id = offer.gift.card.id;
  const selected = useGiftPicks((s) => s.picks.some((p) => p.extraId === id));
  const toggle = useGiftPicks((s) => s.toggle);
  return (
    <GiftTile
      offer={offer}
      selected={selected}
      onToggle={() => toggle(giftLine(offer))}
    />
  );
}

/**
 * Нэг шил — төрөл нь гол үг («Бүтэн шил»), доор нь хэмжээ. Төрөл бүр ганц
 * мөр тул зураг давтахгүй (бүгд нэг үнэртний шил — зураг адилхан).
 */
function BottleRow({ bottle }: { bottle: ShopExtraCard }) {
  const kind = bottleKind(bottle.categorySlug, bottle.mode);
  const leftover = bottle.leftover;
  const meta = leftover
    ? `≈${leftover.remainingMl} / ${leftover.fullMl}ml · Ганц ширхэг`
    : bottleSizeText(bottle);
  return (
    <Link
      href={`/extras/${bottle.slug}`}
      className="hover:bg-accent flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm transition-colors"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {kind ? BOTTLE_KIND[kind].title : bottle.name}
        </span>
        {meta && (
          <span className="text-muted-foreground block text-xs tabular-nums">
            {meta}
          </span>
        )}
      </span>
      <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
        {formatPrice(bottle.fromPrice)}
      </span>
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden
      />
    </Link>
  );
}
