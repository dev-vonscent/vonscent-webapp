"use client";

import * as React from "react";
import { useCart } from "./store";
import { cartMlFor } from "./budget";
import { maxUnits } from "@/features/products/sellable";
import type { ProductDetail } from "@/lib/types";

/**
 * Сагсан дахь мөрүүд ӨНӨӨДӨР зарагдах эсэх.
 *
 * Сагс нь `localStorage`-д (zustand persist) хадгалагддаг тул долоо хоногоор
 * сууж болно: тэр хугацаанд бараа хаагдах, үлдэгдэл дуусах, эсвэл савны
 * түгжээ (0095) орох боломжтой. Сервер тал нь checkout дээр аль хэдийн
 * шалгадаг ч хэрэглэгчид ТЭР ХҮРТЭЛ юу ч мэдэгдэхгүй байсан — энэ дэгээ нь
 * сагс нээгдэхэд нэг удаа асууж, асуудалтай мөрийг тэндээ тэмдэглэнэ.
 *
 * Хүслийн жагсаалттай ижил загвар (`/api/products?ids=…&details=1`).
 */

export interface LineStatus {
  sellable: boolean;
  reason: ProductDetail["variants"][number]["unavailableReason"];
}

const OK: LineStatus = { sellable: true, reason: null };

export function useCartAvailability({
  /**
   * Асуулгыг хойшлуулах — сагсны хуудас үргэлж идэвхтэй, харин drawer нь
   * зөвхөн НЭЭГДЭХЭД асуух ёстой: хаалттай байхад нь хуудас бүр дээр нэмэлт
   * хүсэлт явуулах шалтгаан байхгүй.
   */
  enabled = true,
}: { enabled?: boolean } = {}) {
  const items = useCart((s) => s.items);
  const collections = useCart((s) => s.collections);

  // Барааны id-ууд — өөрчлөгдөхөд л дахин асууна.
  const idKey = React.useMemo(() => {
    const ids = new Set<string>();
    for (const i of items) ids.add(i.productId);
    for (const c of collections) for (const m of c.members) ids.add(m.productId);
    return [...ids].sort().join(",");
  }, [items, collections]);

  const [byVariant, setByVariant] = React.useState<Map<
    string,
    LineStatus
  > | null>(null);
  /**
   * productId → эх савны үлдэгдэл ml. `sellable` нь НЭГ ширхэгийн асуулт тул
   * «хэдэн ширхэг» гэдгийг эндээс бодно: 15ml үлдэгдэлтэй бараанаас 10ml×2
   * авах гэж байгааг сагс өөрөө хэлэх ёстой, checkout хүлээх ёсгүй.
   */
  const [stock, setStock] = React.useState<Map<string, number> | null>(null);

  React.useEffect(() => {
    if (!idKey || !enabled) {
      setByVariant(null);
      setStock(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/products?ids=${idKey}&details=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        const map = new Map<string, LineStatus>();
        const ml = new Map<string, number>();
        for (const p of data.items as ProductDetail[]) {
          ml.set(p.id, p.soldOut ? 0 : p.availableMl);
          for (const v of p.variants) {
            map.set(v.id, {
              sellable: v.sellable,
              reason: v.unavailableReason,
            });
          }
        }
        setByVariant(map);
        setStock(ml);
      })
      // Сүлжээ унасан бол сагсыг хаахгүй — сервер тал нь checkout дээр
      // хамгаална.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idKey, enabled]);

  /**
   * Мэдээлэл ирээгүй, эсвэл мөр танигдаагүй бол «зүгээр» гэж үзнэ: сагсыг
   * буруу шалтгаанаар түгжихээс сервер талын шалгалт руу оруулах нь дээр.
   */
  const statusOf = React.useCallback(
    (variantId: string): LineStatus => byVariant?.get(variantId) ?? OK,
    [byVariant],
  );

  /** Багц нь гишүүдийнхээ хамгийн муу төлөвөөр тодорхойлогдоно. */
  const collectionStatus = React.useCallback(
    (key: string): LineStatus => {
      const c = collections.find((x) => x.key === key);
      if (!c) return OK;
      for (const m of c.members) {
        const s = statusOf(m.variantId);
        if (!s.sellable) return s;
      }
      return OK;
    },
    [collections, statusOf],
  );

  /**
   * Мөрийн тоо ширхэгийн ДЭЭД хязгаар — тухайн барааны үлдэгдлээс сагсны
   * БУСАД мөрийн хэрэглээг хассан. Үлдэгдэл мэдэгдэхгүй (сүлжээ унасан,
   * бараа хариунд ирээгүй) бол `Infinity`: сагсыг буруу түгжихээс сервер
   * талын шалгалт руу оруулах нь дээр.
   */
  const maxQtyOf = React.useCallback(
    (key: string): number => {
      const item = items.find((i) => i.key === key);
      if (!item) return Infinity;
      const availableMl = stock?.get(item.productId);
      if (availableMl == null) return Infinity;
      const usedMl = cartMlFor(item.productId, {
        items: items.filter((i) => i.key !== key),
        collections,
      });
      return maxUnits({
        ml: item.ml,
        sellable: statusOf(item.variantId).sellable,
        remainingMl: availableMl - usedMl,
      });
    },
    [items, collections, stock, statusOf],
  );

  /**
   * Багцын дээд тоо: гишүүн бүр багцын ml-ээр цутгагдана — хамгийн хатуу
   * гишүүн шийднэ (`collectionStatus`-ийн «хамгийн муу гишүүн» загвартай
   * ижил).
   */
  const maxCollectionQtyOf = React.useCallback(
    (key: string): number => {
      const col = collections.find((c) => c.key === key);
      if (!col || col.members.length === 0) return Infinity;
      const others = collections.filter((c) => c.key !== key);
      let cap = Infinity;
      for (const m of col.members) {
        const availableMl = stock?.get(m.productId);
        if (availableMl == null) continue;
        const usedMl = cartMlFor(m.productId, { items, collections: others });
        cap = Math.min(
          cap,
          maxUnits({
            ml: col.ml,
            sellable: statusOf(m.variantId).sellable,
            remainingMl: availableMl - usedMl,
          }),
        );
      }
      return cap;
    },
    [items, collections, stock, statusOf],
  );

  const blockedItemKeys = React.useMemo(
    () =>
      new Set(
        items.filter((i) => !statusOf(i.variantId).sellable).map((i) => i.key),
      ),
    [items, statusOf],
  );

  const blockedCollectionKeys = React.useMemo(
    () =>
      new Set(
        collections
          .filter((c) => !collectionStatus(c.key).sellable)
          .map((c) => c.key),
      ),
    [collections, collectionStatus],
  );

  // Захиалж болохгүй мөрийг сонголтоос ГАРГАНА. Зөвхөн нүдийг нь салгаад
  // орхивол дүн, «сонгосон мөр» тоолуур, checkout гурав нь хоорондоо зөрнө —
  // хэрэглэгч захиалах боломжгүй барааны мөнгийг нийлбэрт хараад эргэлзэнэ.
  const setItemSelected = useCart((s) => s.setItemSelected);
  const setCollectionSelected = useCart((s) => s.setCollectionSelected);
  React.useEffect(() => {
    for (const key of blockedItemKeys) setItemSelected(key, false);
    for (const key of blockedCollectionKeys) setCollectionSelected(key, false);
  }, [
    blockedItemKeys,
    blockedCollectionKeys,
    setItemSelected,
    setCollectionSelected,
  ]);

  /**
   * Сагс `localStorage`-д долоо хоногоор сууна: тэр хугацаанд үлдэгдэл
   * буурч, дотор нь хэвтэж байсан 2 ширхэг захиалагдахаа болино. Мөрийг
   * ЧИМЭЭГҮЙ хасалгүй багтах тоонд нь буулгаад, сонголтоос нь хасахгүй —
   * хэрэглэгч сагсаа нээхэд шинэ тоог хараад шийднэ. Дор хаяж 1 ш ч
   * багтахгүй бол дээрх `blocked*` шалгалт мөрийг аль хэдийн сонголтоос
   * гаргасан байна.
   */
  const setQty = useCart((s) => s.setQty);
  const setCollectionQty = useCart((s) => s.setCollectionQty);
  React.useEffect(() => {
    if (!stock) return;
    for (const i of items) {
      const cap = maxQtyOf(i.key);
      if (cap >= 1 && i.qty > cap) setQty(i.key, cap, cap);
    }
    for (const c of collections) {
      const cap = maxCollectionQtyOf(c.key);
      if (cap >= 1 && c.qty > cap) setCollectionQty(c.key, cap, cap);
    }
  }, [
    stock,
    items,
    collections,
    maxQtyOf,
    maxCollectionQtyOf,
    setQty,
    setCollectionQty,
  ]);

  return {
    statusOf,
    collectionStatus,
    maxQtyOf,
    maxCollectionQtyOf,
    blockedItemKeys,
    blockedCollectionKeys,
    hasBlocked: blockedItemKeys.size > 0 || blockedCollectionKeys.size > 0,
  };
}

/** Мөрний дор харагдах тайлбар. */
export function unavailableLabel(status: LineStatus): string {
  if (status.sellable) return "";
  return status.reason === "bottle"
    ? "Энэ хэмжээний сав түр дууссан байна — өөр хэмжээ сонгоно уу."
    : status.reason === "inactive"
      ? "Энэ хэмжээ зарагдахаа больсон байна."
      : "Энэ хэмжээ түр дууссан байна.";
}
