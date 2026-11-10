"use client";

import { create } from "zustand";
import type { CartExtra } from "@/features/cart/store";

/** Үнэртний хуудсанд сонгосон бэлгийн боодол — сагсны мөрийн оролт. */
export type GiftPick = Omit<CartExtra, "key" | "qty">;

/**
 * Үнэртний хуудасны «Бэлэглэх бол» сонголт (extras-shop-plan §19.4).
 * Сагсанд ШУУД орохгүй: үнэртэнтэй хамт «Сагсанд нэмэх» эсвэл «Захиалах»
 * дарахад тэр замаараа явна. Өмнө нь шууд сагсанд ордог байсан тул
 * «Захиалах» (сагсыг тойрдог) дарахад боодол захиалгад ордоггүй байв.
 *
 * Нэг захиалгын бүх ус нэг боодолд орно (клиент, 2026-11-10) — боодол бүр
 * захиалгад 1 ширхэгээс хэтрэхгүй.
 *
 * Persist хийхгүй — хуудаснаас гарахад (`ProductExtras` unmount) цэвэрлэнэ.
 */
export const useGiftPicks = create<{
  picks: GiftPick[];
  toggle: (pick: GiftPick) => void;
  reset: () => void;
}>((set) => ({
  picks: [],
  toggle: (pick) =>
    set((s) => ({
      picks: s.picks.some((p) => p.extraId === pick.extraId)
        ? s.picks.filter((p) => p.extraId !== pick.extraId)
        : [...s.picks, pick],
    })),
  reset: () => set({ picks: [] }),
}));
