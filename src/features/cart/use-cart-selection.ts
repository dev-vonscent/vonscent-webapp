"use client";

import * as React from "react";
import {
  useCart,
  selectCheckoutItems,
  selectCheckoutCollections,
  selectCheckoutExtras,
} from "@/features/cart/store";

const NONE: ReadonlySet<string> = new Set();

/**
 * Сагсны сонголтын нэгдсэн төлөв — сагсны хуудас, sheet хоёр адилхан
 * checkbox-той толгой мөр, «Бүгдийг сонгох» ба сонгосныг устгах логик
 * хуваалцдаг тул нэг hook дотор.
 *
 * `blocked*` — захиалж болохгүй болсон мөрүүд (`useCartAvailability`).
 * Тэдгээр нь сонголтод ОРОХГҮЙ тул «Бүгдийг сонгох» ч, «n/m» тоолуур ч
 * зөвхөн сонгож болох мөрөөр тоолно: эс бөгөөс хаагдсан мөртэй сагсанд
 * толгойн чагт хэзээ ч тэмдэглэгдэхгүй, дарахад нь хаагдсан мөр сонгогдоно.
 */
export function useCartSelection({
  blockedItemKeys = NONE,
  blockedCollectionKeys = NONE,
  blockedExtraKeys = NONE,
}: {
  blockedItemKeys?: ReadonlySet<string>;
  blockedCollectionKeys?: ReadonlySet<string>;
  /** Нэмэлт бараа: зарагдсан шил, худалдаанаас хасагдсан (useExtrasAvailability). */
  blockedExtraKeys?: ReadonlySet<string>;
} = {}) {
  const items = useCart((s) => s.items);
  const collections = useCart((s) => s.collections);
  const extras = useCart((s) => s.extras);
  const excludedItems = useCart((s) => s.excludedItems);
  const excludedCollections = useCart((s) => s.excludedCollections);
  const excludedExtras = useCart((s) => s.excludedExtras);
  const setAll = useCart((s) => s.setAllSelected);
  const removeSelected = useCart((s) => s.removeSelected);

  const isItemSelected = React.useCallback(
    (key: string) => !excludedItems.includes(key) && !blockedItemKeys.has(key),
    [excludedItems, blockedItemKeys],
  );
  const isCollectionSelected = React.useCallback(
    (key: string) =>
      !excludedCollections.includes(key) && !blockedCollectionKeys.has(key),
    [excludedCollections, blockedCollectionKeys],
  );

  const isExtraSelected = React.useCallback(
    (key: string) => !excludedExtras.includes(key) && !blockedExtraKeys.has(key),
    [excludedExtras, blockedExtraKeys],
  );

  const setAllSelected = React.useCallback(
    (selected: boolean) =>
      setAll(selected, {
        items: [...blockedItemKeys],
        collections: [...blockedCollectionKeys],
        extras: [...blockedExtraKeys],
      }),
    [setAll, blockedItemKeys, blockedCollectionKeys, blockedExtraKeys],
  );

  const lineCount =
    items.filter((i) => !blockedItemKeys.has(i.key)).length +
    collections.filter((c) => !blockedCollectionKeys.has(c.key)).length +
    extras.filter((e) => !blockedExtraKeys.has(e.key)).length;
  const selectedLineCount =
    items.filter((i) => isItemSelected(i.key)).length +
    collections.filter((c) => isCollectionSelected(c.key)).length +
    extras.filter((e) => isExtraSelected(e.key)).length;

  return {
    isItemSelected,
    isCollectionSelected,
    isExtraSelected,
    setAllSelected,
    removeSelected,
    lineCount,
    selectedLineCount,
    allSelected: lineCount > 0 && selectedLineCount === lineCount,
    noneSelected: selectedLineCount === 0,
  };
}

/**
 * Захиалгад орох мөрүүд — checkout ба order payload-д хэрэглэнэ.
 *
 * «Захиалах» (Buy Now) идэвхтэй бол зөвхөн тэр мөр орно: тэр товч сагсыг
 * тойрдог тул сагсанд хэвтэж байсан бараа энд гарах ёсгүй.
 */
export function useCheckoutLines() {
  const buyNow = useCart((s) => s.buyNow);
  const items = useCart((s) => s.items);
  const collections = useCart((s) => s.collections);
  const extras = useCart((s) => s.extras);
  const excludedItems = useCart((s) => s.excludedItems);
  const excludedCollections = useCart((s) => s.excludedCollections);
  const excludedExtras = useCart((s) => s.excludedExtras);
  return {
    buyNow: buyNow != null,
    items: React.useMemo(
      () =>
        buyNow
          ? buyNow.kind === "item"
            ? [buyNow.item]
            : []
          : items.filter((i) => !excludedItems.includes(i.key)),
      [buyNow, items, excludedItems],
    ),
    collections: React.useMemo(
      () =>
        buyNow
          ? buyNow.kind === "collection"
            ? [buyNow.collection]
            : []
          : collections.filter((c) => !excludedCollections.includes(c.key)),
      [buyNow, collections, excludedCollections],
    ),
    extras: React.useMemo(
      () =>
        buyNow
          ? buyNow.kind === "extra"
            ? [buyNow.extra]
            : []
          : extras.filter((e) => !excludedExtras.includes(e.key)),
      [buyNow, extras, excludedExtras],
    ),
  };
}

/** Store-ын гадна (event handler дотор) захиалгад орох мөрүүдийг унших. */
export function getCheckoutLines() {
  const state = useCart.getState();
  return {
    items: selectCheckoutItems(state),
    collections: selectCheckoutCollections(state),
    extras: selectCheckoutExtras(state),
  };
}
