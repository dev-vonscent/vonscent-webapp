import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductListItem } from "@/lib/types";

vi.mock("./quick-add", () => ({
  QuickAdd: () => <button type="button">quick-add</button>,
}));

import { ProductCard } from "./product-card";

function item(over: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: "p1",
    slug: "aventus",
    name: "Aventus",
    brand: "Creed",
    gender: "male",
    concentration: "EDP",
    scentFamilies: [],
    seasons: [],
    image: null,
    startingPrice: 25000,
    startingBasePrice: 25000,
    tags: [],
    isFeatured: false,
    soldOut: false,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("ProductCard — «Тун удахгүй» (0125)", () => {
  it("«Дууссан» биш «Тун удахгүй», хурдан нэмэх товчгүй", () => {
    render(<ProductCard product={item({ soldOut: true, comingSoon: true })} />);
    expect(screen.getByText("Тун удахгүй")).toBeTruthy();
    expect(screen.queryByText("Дууссан")).toBeNull();
    expect(screen.queryByRole("button", { name: "quick-add" })).toBeNull();
  });

  it("үнэ нь харагдана", () => {
    render(<ProductCard product={item({ soldOut: true, comingSoon: true })} />);
    expect(screen.getByText(/25[\s,.]?000/)).toBeTruthy();
  });

  it("энгийн дууссан бараа хэвээр «Дууссан»", () => {
    render(<ProductCard product={item({ soldOut: true })} />);
    expect(screen.getByText("Дууссан")).toBeTruthy();
    expect(screen.queryByText("Тун удахгүй")).toBeNull();
  });

  it("зарагдаж буй бараанд хурдан нэмэх байна", () => {
    render(<ProductCard product={item()} />);
    expect(screen.getByRole("button", { name: "quick-add" })).toBeTruthy();
  });
});
