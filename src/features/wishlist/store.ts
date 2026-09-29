"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  /** Хадгалсан усны id-ууд (`wishlists`). */
  ids: string[];
  /**
   * Хадгалсан бэлэн багцын id-ууд (`collection_wishlists`, 0107). Тусдаа
   * жагсаалт: DB-д ч тусдаа хүснэгт, хуудас ч өөр картаар харуулна.
   * Хуучин persist-д байхгүй тул анхдагч нь `[]`.
   */
  collectionIds: string[];
  toggle: (id: string) => void;
  toggleCollection: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
}

const flip = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      collectionIds: [],
      toggle: (id) => set((s) => ({ ids: flip(s.ids, id) })),
      toggleCollection: (id) =>
        set((s) => ({ collectionIds: flip(s.collectionIds ?? [], id) })),
      has: (id) => get().ids.includes(id),
      clear: () => set({ ids: [], collectionIds: [] }),
    }),
    { name: "vonscent-wishlist" },
  ),
);

/** Хоёр жагсаалтын нийт тоо — доод цэс, бүртгэлийн тоолуур. */
export const selectWishCount = (s: WishlistState) =>
  s.ids.length + (s.collectionIds?.length ?? 0);
