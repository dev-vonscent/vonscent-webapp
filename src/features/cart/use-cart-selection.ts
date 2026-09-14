"use client";

import * as React from "react";
import {
  useCart,
  selectCheckoutItems,
  selectCheckoutCollections,
} from "@/features/cart/store";

/**
 * Сагсны сонголтын нэгдсэн төлөв — сагсны хуудас, sheet хоёр адилхан
 * checkbox-той толгой мөр, «Бүгдийг сонгох» ба сонгосныг устгах логик
 * хуваалцдаг тул нэг hook дотор.
 */
export function useCartSelection() {
  const items = useCart((s) => s.items);
  const collections = useCart((s) => s.collections);
  const excludedItems = useCart((s) => s.excludedItems);
  const excludedCollections = useCart((s) => s.excludedCollections);
  const setAllSelected = useCart((s) => s.setAllSelected);
  const removeSelected = useCart((s) => s.removeSelected);

  const isItemSelected = React.useCallback(
    (key: string) => !excludedItems.includes(key),
    [excludedItems],
  );
  const isCollectionSelected = React.useCallback(
    (key: string) => !excludedCollections.includes(key),
    [excludedCollections],
  );

  const lineCount = items.length + collections.length;
  const selectedLineCount =
    items.filter((i) => !excludedItems.includes(i.key)).length +
    collections.filter((c) => !excludedCollections.includes(c.key)).length;

  return {
    isItemSelected,
    isCollectionSelected,
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
  const excludedItems = useCart((s) => s.excludedItems);
  const excludedCollections = useCart((s) => s.excludedCollections);
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
  };
}

/** Store-ын гадна (event handler дотор) захиалгад орох мөрүүдийг унших. */
export function getCheckoutLines() {
  const state = useCart.getState();
  return {
    items: selectCheckoutItems(state),
    collections: selectCheckoutCollections(state),
  };
}
