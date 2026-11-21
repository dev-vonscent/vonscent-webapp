"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { BOTTLE_KIND, bottleKind } from "../lib/bottle-kind";
import { bottleSizeText } from "../lib/display";
import type { ShopExtraCard } from "../types";

/**
 * Үнэртний хуудасны нэмэлт бараа (extras-shop-plan §9): «Шилээр нь авах» —
 * тухайн үнэртний бүтэн / үлдэгдэлтэй / хоосон шил (шилний хуудасны
 * «Грамаар авах»-ын эсрэг тал). Утсан дээр шилийг олох хамгийн богино зам.
 *
 * Бэлгийн боодол энд БАЙХГҮЙ — зөвхөн төлбөрийн хуудсанд (`CheckoutGiftWrap`,
 * клиентийн засвар 2026-11-21 сл.2): хоёр газар сонгох нь ялгаатай мэт
 * харагдаж байв. Туг хаалттай үед сервер юу ч дамжуулахгүй.
 */
export function ProductExtras({ bottles }: { bottles: ShopExtraCard[] }) {
  return (
    <BottleList id="product-bottles" title="Шилээр нь авах" bottles={bottles} />
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
