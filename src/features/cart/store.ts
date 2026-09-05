"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  /** Stable line key: the variant id. */
  key: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  variantId: string;
  ml: number;
  unitPrice: number;
  qty: number;
  image: string | null;
}

/** The size a line can be switched to, as offered by the product page/API. */
export interface CartVariant {
  variantId: string;
  ml: number;
  unitPrice: number;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
}

/** One member line inside a bundle sitting in the cart. */
export interface CartCollectionMember {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  /** Member price at the bundle ml (pre-discount snapshot). */
  price: number;
}

/** A base or custom bundle in the cart — rendered and edited as one group. */
export interface CartCollection {
  /** Stable key: bundle identity + ml, so identical configs merge. */
  key: string;
  collectionId: string | null;
  type: "base" | "custom";
  slug: string;
  name: string;
  image: string | null;
  discountPct: number;
  ml: number;
  members: CartCollectionMember[];
  /** Discounted bundle price. */
  unitPrice: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  collections: CartCollection[];
  coupon: AppliedCoupon | null;
  add: (item: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  /** Swap a line to a different ml of the same product (todo.md B5). */
  setVariant: (key: string, variant: CartVariant) => void;
  addCollection: (
    collection: Omit<CartCollection, "key" | "qty">,
    qty?: number,
  ) => void;
  removeCollection: (key: string) => void;
  setCollectionQty: (key: string, qty: number) => void;
  setCoupon: (coupon: AppliedCoupon | null) => void;
  clear: () => void;
}

/**
 * Identity of a bundle config: same collection + ml folds together.
 * A custom bundle has no collectionId, so its identity is its member set —
 * otherwise two different custom bundles at the same ml would merge and the
 * second one's members would silently vanish (audit R1).
 */
function collectionKey(c: Omit<CartCollection, "key" | "qty">): string {
  const identity =
    c.collectionId ??
    `custom-${c.members
      .map((m) => m.variantId)
      .sort()
      .join("+")}`;
  return [identity, c.ml].join(":");
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      collections: [],
      coupon: null,
      add: (item, qty = 1) =>
        set((state) => {
          const key = item.variantId;
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, key, qty }] };
        }),
      remove: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      setQty: (key, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i))
            .filter((i) => i.qty > 0),
        })),
      setVariant: (key, variant) =>
        set((state) => {
          const index = state.items.findIndex((i) => i.key === key);
          if (index < 0) return state;
          const nextKey = variant.variantId;
          if (state.items[index].key === nextKey) return state;
          // The target size may already be in the cart; fold the two lines
          // together instead of leaving a duplicate key behind. Rewriting the
          // line in place keeps it where the customer is looking.
          const dupe = state.items.findIndex((i) => i.key === nextKey);
          return {
            items: state.items
              .map((i, n) =>
                n === index
                  ? {
                      ...i,
                      ...variant,
                      key: nextKey,
                      qty: i.qty + (dupe >= 0 ? state.items[dupe].qty : 0),
                    }
                  : i,
              )
              .filter((_, n) => n !== dupe),
          };
        }),
      addCollection: (collection, qty = 1) =>
        set((state) => {
          const key = collectionKey(collection);
          const existing = state.collections.find((c) => c.key === key);
          if (existing) {
            return {
              collections: state.collections.map((c) =>
                c.key === key ? { ...c, qty: c.qty + qty } : c,
              ),
            };
          }
          return {
            collections: [...state.collections, { ...collection, key, qty }],
          };
        }),
      removeCollection: (key) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.key !== key),
        })),
      setCollectionQty: (key, qty) =>
        set((state) => ({
          collections: state.collections
            .map((c) => (c.key === key ? { ...c, qty: Math.max(1, qty) } : c))
            .filter((c) => c.qty > 0),
        })),
      setCoupon: (coupon) => set({ coupon }),
      clear: () => set({ items: [], collections: [], coupon: null }),
    }),
    { name: "vonscent-cart" },
  ),
);

/** Selectors */
export const selectCount = (s: CartState) =>
  s.items.reduce((n, i) => n + i.qty, 0) +
  s.collections.reduce((n, c) => n + c.qty, 0);
export const selectSubtotal = (s: CartState) =>
  s.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0) +
  s.collections.reduce((sum, c) => sum + c.unitPrice * c.qty, 0);
