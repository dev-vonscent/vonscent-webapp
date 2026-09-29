import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Collection, CollectionPriceAtMl } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ trackBeginCheckout: vi.fn() }));

import { CollectionDetail } from "./collection-detail";

function price(
  ml: number,
  value: number,
  available = true,
): CollectionPriceAtMl {
  return {
    ml,
    memberSum: value,
    price: value,
    discountPct: 5,
    nominalDiscountPct: 5,
    saved: 0,
    available,
  };
}

function collection(prices: CollectionPriceAtMl[]): Collection {
  const member = (id: string) => ({
    productId: id,
    slug: id,
    name: id,
    brand: "B",
    image: null,
    variantByMl: {},
  });
  return {
    id: "c1",
    type: "base",
    slug: "summer",
    name: "Зуны багц",
    image: null,
    description: "",
    soldOut: false,
    members: ["a", "b", "c", "d"].map(member),
    prices,
    availableMls: prices.filter((p) => p.available).map((p) => p.ml),
  } as unknown as Collection;
}

describe("CollectionDetail size buttons", () => {
  const PRICES = [
    price(2, 40000),
    price(5, 90000),
    price(10, 133000),
    price(20, 240000, false),
  ];

  it("shows one scent's size × the scent count and the ₮/ml", () => {
    render(<CollectionDetail collection={collection(PRICES)} />);
    const tenMl = screen.getByRole("radio", { name: "10ml ×4" });
    expect(tenMl.textContent).toContain("10ml ×4");
    // 133,000₮ / 40ml = 3,325₮/ml
    expect(tenMl.textContent).toContain("3,325₮/ml");
  });

  it("keeps «Хамгийн ашигтай» on the cheapest ₮/ml size even when it is unavailable", () => {
    render(<CollectionDetail collection={collection(PRICES)} />);
    expect(screen.getByText("Хамгийн ашигтай").closest("[role=radio]")).toBe(
      screen.getByRole("radio", { name: "20ml ×4 — байхгүй" }),
    );
  });

  it("labels 2ml «Туршиж үзэх»", () => {
    render(<CollectionDetail collection={collection(PRICES)} />);
    expect(screen.getByText("Туршиж үзэх").closest("[role=radio]")).toBe(
      screen.getByRole("radio", { name: "2ml ×4" }),
    );
  });
});
