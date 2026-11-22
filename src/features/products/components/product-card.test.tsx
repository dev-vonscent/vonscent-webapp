import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductListItem } from "@/lib/types";

vi.mock("./quick-add", () => ({
  QuickAdd: () => <button type="button">quick-add</button>,
}));

import { CardPrice, ProductCard } from "./product-card";

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

describe("ProductCard — «Хямдралтай» chip + хувь (2.3, 2.4)", () => {
  it("бүх хэмжээ өөр хувьтай → «Хямдралтай 10–30%»", () => {
    render(
      <ProductCard
        product={item({
          tags: ["sale"],
          sale: { minPct: 10, maxPct: 30, allSizes: true },
        })}
      />,
    );
    expect(screen.getByText("Хямдралтай")).toBeTruthy();
    expect(screen.getByText("10–30%")).toBeTruthy();
  });

  it("аль нэг хэмжээ хямдралгүй → «~30%»", () => {
    render(
      <ProductCard
        product={item({
          tags: ["sale"],
          sale: { minPct: 10, maxPct: 30, allSizes: false },
        })}
      />,
    );
    expect(screen.getByText("~30%")).toBeTruthy();
  });

  it("гар хямдралын chip: нэр бүтэн багтвал л, эс бөгөөс зөвхөн хувь (5, 2026-11-21)", () => {
    render(
      <ProductCard
        product={item({
          tags: ["sale"],
          sale: { minPct: 10, maxPct: 30, allSizes: false },
        })}
      />,
    );
    const pct = screen.getByText("~30%");
    expect(pct.className).toContain("shrink-0");
    const chip = pct.parentElement!;
    expect(chip.className).toContain("max-w-full");
    // Арга хэмжээний chip-тэй ижил: «Хямдралт…» таслалт үгүй — нэр нь
    // container query-гээр бүтэн эсвэл огт үгүй.
    const name = screen.getByText("Хямдралтай");
    expect(name.className).not.toContain("truncate");
    expect(name.hasAttribute("data-chip-name")).toBe(true);
    expect(name.className).toMatch(/hidden @min-\[\d+px\]\/chip:inline/);
    const row = chip.parentElement!;
    expect(row.className).toContain("right-12");
    // Арга хэмжээний chip-ийн нарийн/өргөн шийдвэрийн container.
    expect(row.className).toContain("@container/chip");
  });

  it("хямдралгүй бараанд chip гарахгүй", () => {
    render(<ProductCard product={item()} />);
    expect(screen.queryByText("Хямдралтай")).toBeNull();
  });
});

describe("CardPrice (task 2.5)", () => {
  it("cardPrice байвал хэмжээгүй «хямдарсан ~~үндсэн~~» (сл.4)", () => {
    render(
      <CardPrice
        product={{
          startingPrice: 12000,
          startingBasePrice: 12000,
          cardPrice: { ml: 5, price: 21300, basePrice: 25000 },
        }}
      />,
    );
    const el = screen.getByTestId("card-price");
    expect(el.textContent).toBe("21,300₮25,000₮");
    expect(screen.getByText("25,000₮").className).toContain("line-through");
  });

  it("cardPrice байхгүй бол хамгийн бага үнэ", () => {
    render(
      <CardPrice
        product={{ startingPrice: 12000, startingBasePrice: 12000 }}
      />,
    );
    expect(screen.getByTestId("card-price").textContent).toBe("12,000₮");
  });
});
