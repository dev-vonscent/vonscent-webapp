"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { useCart } from "@/features/cart/store";
import { useCheckoutLines } from "@/features/cart/use-cart-selection";
import type { ShopExtraDetail } from "../types";
import { GiftTile, giftLine, giftOffers, type GiftOffer } from "./gift-tile";

/**
 * Төлбөрийн хуудасны «Бэлгийн боодол» (extras-shop-plan §19.4) — туг
 * `extras_shop` нээлттэй үед хуучин үнэгүй «Бэлгийн боолт хийлгэх» chip-ийн
 * оронд. Бэлэглэх сонголт нэг л газар: үнэртний хуудсанд сонгосон нь энд
 * сонгогдсон харагдана, сагсаар ирсэн хүн энд анх удаа харна.
 *
 * Нэг захиалгын бүх ус нэг боодолд орно (клиент, 2026-11-10) — боодол бүр
 * 1 ширхэг. Хайрцаг + уут зэрэг сонгож болно (хайрцгийг уутанд хийнэ).
 * «Захиалах» замаар бол buy-now мөрийн `addOns`, сагсаар бол сагсны мөр.
 *
 * Боодлын бараа нэг ч байхгүй (туг нээгдсэн ч бараа оруулаагүй, бүгд
 * дууссан) эсвэл уншиж чадаагүй бол `fallback` — хуучин үнэгүй «Бэлгийн
 * боолт хийлгэх» chip. Эс бөгөөс тэр хугацаанд боолт сонгох газар үгүй болдог.
 * `onOfferedChange` — эцэг нь chip-ийн тэмдэглэлийг захиалгад оруулах эсэхээ
 * мэднэ (хадгалсан checkout-оос сэргэсэн нуугдмал chip илгээгдэхгүй).
 */
export function CheckoutGiftWrap({
  fallback,
  onOfferedChange,
}: {
  fallback?: React.ReactNode;
  onOfferedChange?: (offered: boolean) => void;
}) {
  // null — уншиж байна: chip анивчиж гараад алга болохгүйн тулд юу ч үгүй.
  const [offers, setOffers] = React.useState<GiftOffer[] | null>(null);
  const { buyNow, extras } = useCheckoutLines();
  const addExtra = useCart((s) => s.addExtra);
  const addBuyNowAddOn = useCart((s) => s.addBuyNowAddOn);
  const removeExtra = useCart((s) => s.removeExtra);
  // Нэмэлт барааны «Захиалах» (жишээ нь шил) — мөр нь өөрөө нэмэлт бараа,
  // боодол хавсаргах үнэртэн байхгүй.
  const buyNowKind = useCart((s) => s.buyNow?.kind);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/extras?gifts=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { gifts?: ShopExtraDetail[] } | null) => {
        if (!cancelled) setOffers(d?.gifts ? giftOffers(d.gifts) : []);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const offered = offers != null && offers.length > 0;
  React.useEffect(() => {
    onOfferedChange?.(offered);
  }, [offered, onOfferedChange]);

  if (offers == null || (buyNow && buyNowKind !== "item")) return null;
  if (offers.length === 0) return <>{fallback}</>;

  const lineOf = (o: GiftOffer) => {
    const ids = o.gift.variants.map((v) => v.id);
    return extras.find((e) => ids.includes(e.key));
  };

  return (
    <div className="space-y-2">
      <Label>Бэлгийн боодол (заавал биш)</Label>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-7">
        {offers.map((o) => {
          const line = lineOf(o);
          return (
            <li key={o.gift.card.id}>
              <GiftTile
                offer={o}
                selected={line != null}
                onToggle={() => {
                  if (line) removeExtra(line.key);
                  else if (buyNow) addBuyNowAddOn(giftLine(o));
                  else addExtra(giftLine(o), 1, 1);
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
