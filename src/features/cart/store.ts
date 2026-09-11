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
  /**
   * Lines the customer has *unchecked*, by line key — not the checked ones.
   * Stored as the complement so a newly added line is selected without the
   * add path having to touch selection, and so an older persisted cart (which
   * has no such field) starts out fully selected.
   */
  excludedItems: string[];
  excludedCollections: string[];
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
  /** Check/uncheck one product line for ordering. */
  setItemSelected: (key: string, selected: boolean) => void;
  /** Check/uncheck one bundle line for ordering. */
  setCollectionSelected: (key: string, selected: boolean) => void;
  /** Check/uncheck every line at once (сагсны «Бүгдийг сонгох»). */
  setAllSelected: (selected: boolean) => void;
  /** Drop only the checked lines — what an order takes out of the cart. */
  removeSelected: () => void;
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
      excludedItems: [],
      excludedCollections: [],
      coupon: null,
      add: (item, qty = 1) =>
        set((state) => {
          const key = item.variantId;
          const existing = state.items.find((i) => i.key === key);
          // Adding a line is a buying intent, so it always comes back checked
          // even if the same line was unchecked earlier.
          const excludedItems = state.excludedItems.filter((k) => k !== key);
          if (existing) {
            return {
              excludedItems,
              items: state.items.map((i) =>
                i.key === key ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return {
            excludedItems,
            items: [...state.items, { ...item, key, qty }],
          };
        }),
      remove: (key) =>
        set((state) => ({
          items: state.items.filter((i) => i.key !== key),
          excludedItems: state.excludedItems.filter((k) => k !== key),
        })),
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
          // Selection is keyed by variant id, so a size swap has to carry the
          // checkbox across to the new key — otherwise an unchecked line comes
          // back checked just because its size changed.
          const wasExcluded = state.excludedItems.includes(key);
          const excludedItems = state.excludedItems.filter(
            (k) => k !== key && k !== nextKey,
          );
          return {
            excludedItems: wasExcluded
              ? [...excludedItems, nextKey]
              : excludedItems,
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
          const excludedCollections = state.excludedCollections.filter(
            (k) => k !== key,
          );
          if (existing) {
            return {
              excludedCollections,
              collections: state.collections.map((c) =>
                c.key === key ? { ...c, qty: c.qty + qty } : c,
              ),
            };
          }
          return {
            excludedCollections,
            collections: [...state.collections, { ...collection, key, qty }],
          };
        }),
      removeCollection: (key) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.key !== key),
          excludedCollections: state.excludedCollections.filter(
            (k) => k !== key,
          ),
        })),
      setCollectionQty: (key, qty) =>
        set((state) => ({
          collections: state.collections
            .map((c) => (c.key === key ? { ...c, qty: Math.max(1, qty) } : c))
            .filter((c) => c.qty > 0),
        })),
      setItemSelected: (key, selected) =>
        set((state) => ({
          excludedItems: selected
            ? state.excludedItems.filter((k) => k !== key)
            : state.excludedItems.includes(key)
              ? state.excludedItems
              : [...state.excludedItems, key],
        })),
      setCollectionSelected: (key, selected) =>
        set((state) => ({
          excludedCollections: selected
            ? state.excludedCollections.filter((k) => k !== key)
            : state.excludedCollections.includes(key)
              ? state.excludedCollections
              : [...state.excludedCollections, key],
        })),
      setAllSelected: (selected) =>
        set((state) =>
          selected
            ? { excludedItems: [], excludedCollections: [] }
            : {
                excludedItems: state.items.map((i) => i.key),
                excludedCollections: state.collections.map((c) => c.key),
              },
        ),
      removeSelected: () =>
        set((state) => ({
          items: state.items.filter((i) => state.excludedItems.includes(i.key)),
          collections: state.collections.filter((c) =>
            state.excludedCollections.includes(c.key),
          ),
          // Every surviving line was excluded, so nothing stays checked and
          // the exclusion lists have to be rebuilt, not carried over.
          excludedItems: state.items
            .filter((i) => state.excludedItems.includes(i.key))
            .map((i) => i.key),
          excludedCollections: state.collections
            .filter((c) => state.excludedCollections.includes(c.key))
            .map((c) => c.key),
          // A coupon was validated against the ordered subtotal; what is left
          // in the cart is a different basket.
          coupon: null,
        })),
      setCoupon: (coupon) => set({ coupon }),
      clear: () =>
        set({
          items: [],
          collections: [],
          excludedItems: [],
          excludedCollections: [],
          coupon: null,
        }),
    }),
    { name: "vonscent-cart" },
  ),
);

/** Selectors */

/** Every line in the cart, checked or not — what the header badge counts. */
export const selectCount = (s: CartState) =>
  s.items.reduce((n, i) => n + i.qty, 0) +
  s.collections.reduce((n, c) => n + c.qty, 0);

export const isItemSelected = (s: CartState, key: string) =>
  !s.excludedItems.includes(key);
export const isCollectionSelected = (s: CartState, key: string) =>
  !s.excludedCollections.includes(key);

/** Checked product lines — the ones an order is built from. */
export const selectedItems = (s: CartState) =>
  s.items.filter((i) => !s.excludedItems.includes(i.key));
/** Checked bundle lines. */
export const selectedCollections = (s: CartState) =>
  s.collections.filter((c) => !s.excludedCollections.includes(c.key));

/** Units the customer is about to order (checked lines only). */
export const selectSelectedCount = (s: CartState) =>
  selectedItems(s).reduce((n, i) => n + i.qty, 0) +
  selectedCollections(s).reduce((n, c) => n + c.qty, 0);

/**
 * Payable subtotal: **checked lines only**. Everything downstream — coupon
 * validation, delivery estimate, the order itself — is about what is being
 * bought, so an unchecked line must not show up in any total.
 */
export const selectSubtotal = (s: CartState) =>
  selectedItems(s).reduce((sum, i) => sum + i.unitPrice * i.qty, 0) +
  selectedCollections(s).reduce((sum, c) => sum + c.unitPrice * c.qty, 0);

/** True when at least one line is unchecked (for the «select all» box). */
export const selectHasExcluded = (s: CartState) =>
  s.excludedItems.length > 0 || s.excludedCollections.length > 0;
