"use client";

import * as React from "react";
import { useFeatureFlag } from "@/components/feature-flags";
import { useCart } from "@/features/cart/store";
import type { ShopExtraCard } from "../types";
import { ExtraCard } from "./extra-card";

/**
 * Сагсны «Захиалгаа гүйцээх» (extras-shop-plan §9, §13) — үнэртэн авч буй
 * хүнд бэлэг барих хайрцаг, уут. Сагсанд аль хэдийн нэмэлт бараа байвал
 * гарахгүй (давтан санал болгохгүй).
 */
export function CartCompleteOrder() {
  const on = useFeatureFlag("extras_shop");
  const hasPerfume = useCart((s) => s.items.length + s.collections.length > 0);
  const hasExtras = useCart((s) => s.extras.length > 0);
  const show = on && hasPerfume && !hasExtras;
  const [items, setItems] = React.useState<ShopExtraCard[]>([]);

  React.useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetch("/api/extras")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: ShopExtraCard[] } | null) => {
        if (!cancelled && d?.items) setItems(d.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [show]);

  if (!show || items.length === 0) return null;
  return (
    <section aria-labelledby="cart-complete" className="space-y-3 pt-4">
      <div>
        <h2
          id="cart-complete"
          className="font-serif text-lg font-semibold tracking-tight"
        >
          Захиалгаа гүйцээх
        </h2>
        <p className="text-muted-foreground text-sm">
          Бэлэг барих бол хайрцаг, уутаа хамт аваарай.
        </p>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {items.map((e) => (
          <li key={e.id} className="w-[40%] shrink-0 snap-start md:w-auto">
            <ExtraCard
              extra={e}
              href={`/extras/${e.slug}`}
              sizes="200px"
              quickAdd
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
