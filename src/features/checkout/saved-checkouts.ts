"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/features/cart/store";
import type { CartCollection, CartItem } from "@/features/cart/store";
import { toLineInput } from "./pending-order";

/**
 * «Дараа авахаар хадгалах» — checkout дээр бөглөсөн захиалгыг бүтнээр нь
 * (мөр + хаяг, хүлээн авагч) бүртгэлд хадгална (`saved_checkouts`, 0116;
 * клиент, 2026-10). «Миний захиалга» хэсгээс «Захиалах» дарахад мөрүүд нь
 * сагсанд буцаж орж, маягт бөглөгдсөн checkout нээгдэнэ.
 *
 * Сервер дээрх захиалга биш тул нөөц түгжихгүй, үнэ ч тогтохгүй: захиалах
 * мөчид checkout одоогийн үнээр дахин бодно.
 */

/** Checkout-ийн `?next=` ноорог уншдаг sessionStorage түлхүүр. */
export const CHECKOUT_DRAFT_KEY = "vonscent-checkout-draft";

export const SAVED_CHECKOUTS_QUERY_KEY = ["saved-checkouts"] as const;

export interface SavedCheckout {
  id: string;
  /** ISO — `created_at`. */
  savedAt: string;
  /** «Захиалах» замаар ирсэн нэг мөр — сагсанд хэзээ ч ороогүй. */
  buyNow: boolean;
  items: CartItem[];
  collections: CartCollection[];
  /** Checkout-ийн маягтын ноорог (`CheckoutDraft`). */
  draft: Record<string, unknown>;
}

export type SavedCheckoutInput = Omit<SavedCheckout, "id" | "savedAt">;

interface SavedCheckoutRow {
  id: string;
  buy_now: boolean;
  items: CartItem[];
  collections: CartCollection[];
  draft: Record<string, unknown>;
  created_at: string;
}

const fromRow = (r: SavedCheckoutRow): SavedCheckout => ({
  id: r.id,
  savedAt: r.created_at,
  buyNow: r.buy_now,
  items: r.items,
  collections: r.collections,
  draft: r.draft,
});

/** Нэвтэрсэн хэрэглэгчийн хадгалсан захиалгууд (шинэ нь эхэнд). */
export function useSavedCheckouts() {
  return useQuery<SavedCheckout[]>({
    queryKey: SAVED_CHECKOUTS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/account/saved-checkouts", {
        cache: "no-store",
      });
      // Нэвтрээгүй бол жагсаалт зүгээр л хоосон.
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("saved_checkouts_failed");
      const data = (await res.json()) as { saved: SavedCheckoutRow[] };
      return data.saved.map(fromRow);
    },
  });
}

/** Хадгалах. 401 = нэвтрээгүй — дуудагч нэвтрэх рүү шилжүүлнэ. */
export async function postSavedCheckout(input: SavedCheckoutInput) {
  const res = await fetch("/api/account/saved-checkouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "SAVE_FAILED");
  }
}

export function useDeleteSavedCheckout() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/account/saved-checkouts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("DELETE_FAILED");
    },
    // Шууд жагсаалтаас авна — сүлжээ удаан ч карт тэр дороо алга болно.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SAVED_CHECKOUTS_QUERY_KEY });
      const previous = queryClient.getQueryData<SavedCheckout[]>(
        SAVED_CHECKOUTS_QUERY_KEY,
      );
      queryClient.setQueryData<SavedCheckout[]>(
        SAVED_CHECKOUTS_QUERY_KEY,
        (list) => list?.filter((x) => x.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      const previous = (context as { previous?: SavedCheckout[] } | undefined)
        ?.previous;
      if (previous)
        queryClient.setQueryData(SAVED_CHECKOUTS_QUERY_KEY, previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: SAVED_CHECKOUTS_QUERY_KEY,
      });
    },
  });
}

/** Хадгалсан захиалгын барааны дүн (хадгалах үеийн үнээр). */
export function savedSubtotal(entry: SavedCheckout): number {
  return (
    entry.items.reduce((n, i) => n + i.unitPrice * i.qty, 0) +
    entry.collections.reduce((n, c) => n + c.unitPrice * c.qty, 0)
  );
}

/**
 * Хадгалсныг checkout руу буцаана: мөрүүдийг сагсанд хийж ЗӨВХӨН тэднийг
 * сонгоно (бусад сагсны мөр сагсандаа үлдэнэ), маягтын ноорогийг checkout
 * mount үед уншигдах газар тавина. Серверээс устгах нь дуудагчийн ажил —
 * мөрүүд нь одоо сагсанд байгаа тул алдагдахгүй.
 */
export function resumeSavedCheckout(entry: SavedCheckout) {
  const cart = useCart.getState();
  if (entry.buyNow) {
    const [item] = entry.items;
    const [bundle] = entry.collections;
    if (item) cart.startBuyNow(...toLineInput(item));
    else if (bundle) cart.startBuyNowCollection(...toLineInput(bundle));
  } else {
    cart.clearBuyNow();
    for (const item of entry.items) cart.add(...toLineInput(item));
    for (const bundle of entry.collections)
      cart.addCollection(...toLineInput(bundle));
    // Нэмсний ДАРАА түлхүүрүүдийг уншина — сагс нь ижил мөрийг нэгтгэдэг.
    const state = useCart.getState();
    const itemKeys = new Set(
      state.items
        .filter((i) =>
          entry.items.some((e) => e.variantId === i.variantId && e.ml === i.ml),
        )
        .map((i) => i.key),
    );
    const bundleKeys = new Set(
      state.collections
        .filter((c) =>
          entry.collections.some(
            (e) =>
              e.ml === c.ml &&
              e.collectionId === c.collectionId &&
              e.members.map((m) => m.variantId).join() ===
                c.members.map((m) => m.variantId).join(),
          ),
        )
        .map((c) => c.key),
    );
    useCart.setState({
      excludedItems: state.items
        .filter((i) => !itemKeys.has(i.key))
        .map((i) => i.key),
      excludedCollections: state.collections
        .filter((c) => !bundleKeys.has(c.key))
        .map((c) => c.key),
    });
  }
  try {
    sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(entry.draft));
  } catch {
    // Ноорог алга болно — мөрүүд нь сагсанд орсон тул урсгал таслахгүй.
  }
}
