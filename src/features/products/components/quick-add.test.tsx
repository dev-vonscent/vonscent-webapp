import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductDetail, ProductListItem, Variant } from "@/lib/types";
import type {
  Collection,
  CollectionPriceAtMl,
} from "@/features/collections/types";

vi.mock("@/lib/analytics", () => ({ trackAddToCart: vi.fn() }));

import { QuickAdd } from "./quick-add";
import { CollectionQuickAdd } from "@/features/collections/components/collection-quick-add";

const variant = (ml: number, price: number, basePrice = price): Variant => ({
  id: `v${ml}`,
  ml,
  price,
  basePrice,
  isActive: true,
  inStock: true,
  bottleLocked: false,
  sellable: true,
  unavailableReason: null,
});

afterEach(() => vi.unstubAllGlobals());

describe("quick-add анхдагч хэмжээ (6)", () => {
  const variants = [
    variant(2, 12000),
    variant(5, 21300, 25000),
    variant(10, 45000),
  ];
  const detail = {
    id: "p1",
    slug: "hero",
    name: "Hero",
    brand: "B",
    image: null,
    soldOut: false,
    variants,
    availableMl: 100,
  } as unknown as ProductDetail;

  async function open(item: Partial<ProductListItem>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ product: detail }),
      })),
    );
    render(
      <QuickAdd
        product={
          {
            ...detail,
            startingPrice: 12000,
            startingBasePrice: 12000,
            ...item,
          } as ProductListItem
        }
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Сагсанд нэмэх" }),
    );
    return screen.findByRole("radiogroup");
  }

  it("карт «5ml · 21,300₮» харуулж байвал 5ml сонгогдсон", async () => {
    await open({ cardPrice: { ml: 5, price: 21300, basePrice: 25000 } });
    expect(
      screen.getByRole("radio", { name: /^5ml/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("cardPrice байхгүй бол зарагдах эхний хэмжээ (2ml)", async () => {
    await open({});
    expect(
      screen.getByRole("radio", { name: "2ml" }).getAttribute("aria-checked"),
    ).toBe("true");
  });
});

describe("багцын quick-add анхдагч хэмжээ (6)", () => {
  const row = { variantId: "x", price: 1, inStock: true };
  const price = (
    ml: number,
    value: number,
    over: Partial<CollectionPriceAtMl> = {},
  ): CollectionPriceAtMl => ({
    ml,
    memberSum: value,
    price: value,
    discountPct: 5,
    nominalDiscountPct: 5,
    saved: 0,
    available: true,
    ...over,
  });
  const collection = (prices: CollectionPriceAtMl[]) =>
    ({
      id: "c1",
      slug: "night",
      name: "Night",
      image: null,
      members: ["a", "b"].map((id) => ({
        productId: id,
        name: id,
        variantByMl: { 2: row, 5: row, 10: row },
      })),
      prices,
      availableMls: prices.map((p) => p.ml),
      startingPrice: prices[0].price,
    }) as unknown as Collection;

  it("хамгийн их хувь 10ml-д → карт 10ml-ийн үнэ, quick-add 10ml", async () => {
    render(
      <CollectionQuickAdd
        collection={collection([
          price(2, 40000),
          price(5, 90000),
          price(10, 120000, {
            memberSum: 133400,
            eventSaving: 6000,
            nominalDiscountPct: 10,
          }),
        ])}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Сагсанд нэмэх" }),
    );
    expect(
      screen
        .getByRole("radio", { name: /^10ml ×2/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("хямдралгүй бол эхний хэмжээ", async () => {
    render(
      <CollectionQuickAdd
        collection={collection([price(2, 40000), price(5, 90000)])}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Сагсанд нэмэх" }),
    );
    expect(
      screen
        .getByRole("radio", { name: "2ml ×2" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
});
