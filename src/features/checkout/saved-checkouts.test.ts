// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useCart, selectCheckoutItems } from "@/features/cart/store";
import { savedCheckoutInputSchema } from "@/lib/validators/saved-checkout";
import {
  CHECKOUT_DRAFT_KEY,
  resumeSavedCheckout,
  savedSubtotal,
  type SavedCheckout,
} from "./saved-checkouts";

const line = (variantId: string, unitPrice: number) => ({
  productId: `p-${variantId}`,
  slug: `s-${variantId}`,
  name: `N ${variantId}`,
  brand: "B",
  variantId,
  ml: 5,
  unitPrice,
  image: null,
});

const saved = (over: Partial<SavedCheckout>): SavedCheckout => ({
  id: "00000000-0000-0000-0000-000000000001",
  savedAt: "2026-10-06T00:00:00Z",
  buyNow: false,
  items: [],
  collections: [],
  draft: {},
  ...over,
});

beforeEach(() => {
  useCart.getState().clear();
  sessionStorage.clear();
});

describe("resumeSavedCheckout", () => {
  it("resumes only the saved lines, leaving the rest of the cart unchecked", () => {
    useCart.getState().add(line("other", 1000));
    const entry = saved({
      items: [{ ...line("a", 2000), key: "a", qty: 2 }],
      draft: { values: { contactName: "Бат" } },
    });
    expect(savedSubtotal(entry)).toBe(4000);

    resumeSavedCheckout(entry);

    const checkout = selectCheckoutItems(useCart.getState());
    expect(checkout.map((i) => [i.variantId, i.qty])).toEqual([["a", 2]]);
    // The other line stays in the cart, just not in this order.
    expect(useCart.getState().items).toHaveLength(2);
    expect(JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT_KEY)!)).toEqual({
      values: { contactName: "Бат" },
    });
  });

  it("resumes a buy-now line without touching the cart", () => {
    useCart.getState().add(line("other", 1000));
    resumeSavedCheckout(
      saved({
        buyNow: true,
        items: [{ ...line("a", 2000), key: "a", qty: 1 }],
      }),
    );

    const state = useCart.getState();
    expect(state.buyNow?.kind).toBe("item");
    expect(selectCheckoutItems(state).map((i) => i.variantId)).toEqual(["a"]);
    expect(state.items.map((i) => i.variantId)).toEqual(["other"]);
  });
});

describe("savedCheckoutInputSchema", () => {
  const valid = {
    buyNow: false,
    items: [{ ...line("a", 2000), key: "a", qty: 1 }],
    collections: [],
    draft: { values: {} },
  };

  it("accepts a cart snapshot", () => {
    expect(savedCheckoutInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty order", () => {
    expect(
      savedCheckoutInputSchema.safeParse({ ...valid, items: [] }).success,
    ).toBe(false);
  });

  it("rejects a size outside ML_SIZES", () => {
    expect(
      savedCheckoutInputSchema.safeParse({
        ...valid,
        items: [{ ...valid.items[0], ml: 7 }],
      }).success,
    ).toBe(false);
  });
});
