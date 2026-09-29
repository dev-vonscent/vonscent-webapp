import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OrderLines } from "./order-lines";
import type { CartCollection, CartItem } from "@/features/cart/store";

function item(over: Partial<CartItem> = {}): CartItem {
  return {
    key: "v1",
    productId: "p1",
    slug: "p1",
    name: "Aventus",
    brand: "Creed",
    variantId: "v1",
    ml: 10,
    unitPrice: 50000,
    qty: 1,
    image: null,
    ...over,
  };
}

function bundle(over: Partial<CartCollection> = {}): CartCollection {
  return {
    key: "b1",
    collectionId: "c1",
    type: "base",
    slug: "summer",
    name: "Зуны багц",
    image: null,
    discountPct: 10,
    ml: 5,
    members: [
      {
        productId: "p2",
        variantId: "m1",
        slug: "p2",
        name: "Neroli Portofino",
        brand: "Tom Ford",
        image: null,
        price: 30000,
      },
    ],
    unitPrice: 27000,
    qty: 1,
    ...over,
  };
}

describe("OrderLines", () => {
  it("folds the bundle's scent list away until asked", async () => {
    render(<OrderLines items={[]} collections={[bundle()]} />);

    expect(screen.getByText("Багц · 5ml · 1 үнэртэн")).toBeTruthy();
    expect(screen.queryByText(/Neroli Portofino/)).toBeNull();

    const toggle = screen.getByRole("button", { name: /Дэлгэх/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(toggle);
    expect(screen.getByText(/Tom Ford — Neroli Portofino/)).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows two lines and counts the rest", async () => {
    render(
      <OrderLines
        items={[
          item({ key: "a", name: "A" }),
          item({ key: "b", name: "B" }),
          item({ key: "c", name: "C" }),
        ]}
        collections={[]}
      />,
    );

    expect(screen.queryByText("C")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /дахиад 1 бараа/ }),
    );
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Хураах/ })).toBeTruthy();
  });

  it("has nothing to fold for a short, bundle-free order", () => {
    render(<OrderLines items={[item()]} collections={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("50,000₮")).toBeTruthy();
  });

  it("prices a bundle at its base price, the saving shown elsewhere", () => {
    render(<OrderLines items={[]} collections={[bundle({ qty: 2 })]} />);
    // 30,000 × 2 — not the discounted 27,000.
    expect(screen.getByText("60,000₮")).toBeTruthy();
  });
});
