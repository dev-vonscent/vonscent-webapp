import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import type { Collection, CollectionPriceAtMl } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ trackBeginCheckout: vi.fn() }));

import { CollectionDetail } from "./collection-detail";

function price(
  ml: number,
  value: number,
  available = true,
  over: Partial<CollectionPriceAtMl> = {},
): CollectionPriceAtMl {
  return {
    ml,
    memberSum: value,
    price: value,
    discountPct: 5,
    nominalDiscountPct: 5,
    saved: 0,
    available,
    ...over,
  };
}

function collection(
  prices: CollectionPriceAtMl[],
  over: Partial<Collection> = {},
): Collection {
  // 20ml: «d» гишүүнд энэ хэмжээ БАЙХГҮЙ (зарахгүй) — бусад нь бүрэн.
  const row = { variantId: "x", price: 1, inStock: true };
  const member = (id: string) => ({
    productId: id,
    slug: id,
    name: id,
    brand: "B",
    image: null,
    variantByMl:
      id === "d"
        ? { 2: row, 5: row, 10: row }
        : { 2: row, 5: row, 10: row, 20: row },
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
    ...over,
  } as unknown as Collection;
}

describe("CollectionDetail size buttons", () => {
  const PRICES = [
    price(2, 40000),
    price(5, 90000),
    price(10, 133000),
    price(20, 240000, false),
  ];

  it("card: one scent's size × the scent count and sprays, no price", () => {
    render(<CollectionDetail collection={collection(PRICES)} />);
    const tenMl = screen.getByRole("radio", { name: "10ml ×4" });
    expect(tenMl.textContent).toBe("10ml ×4тус\u00a0бүр 150 цацалт");
    expect(tenMl.textContent).not.toMatch(/₮/);
  });

  it("size missing from a member is not selectable («Байхгүй»)", async () => {
    render(<CollectionDetail collection={collection(PRICES)} />);
    const twenty = screen.getByRole("radio", { name: "20ml ×4 — Байхгүй" });
    expect(twenty.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(twenty);
    expect(twenty.getAttribute("aria-checked")).toBe("false");
  });

  it("out-of-stock bundle size is selectable, shows its price, buttons «Дууссан»", async () => {
    const prices = [
      price(2, 40000),
      price(5, 90000, false),
      price(10, 133000),
      price(20, 240000, false),
    ];
    render(<CollectionDetail collection={collection(prices)} />);
    const five = screen.getByRole("radio", { name: "5ml ×4 — Дууссан" });
    await userEvent.click(five);
    expect(five.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("size-price").textContent).toContain("90,000₮");
    expect(
      (screen.getByRole("button", { name: "Дууссан" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("hint under the selector follows the selected size", async () => {
    render(<CollectionDetail collection={collection(PRICES)} />);
    expect(screen.getByTestId("size-hint").textContent).toBe(
      "Үнэртэн тус бүр 30 цацалт, эрсдэлгүй туршилт",
    );
    await userEvent.click(screen.getByRole("radio", { name: "10ml ×4" }));
    expect(screen.getByTestId("size-hint").textContent).toBe(
      "Аялалд, онгоцонд ч зөвшөөрөгдөнө",
    );
  });

  it("price header: bundle price, member sum crossed out, the promised %", () => {
    const prices = [
      price(2, 38000, true, { memberSum: 40000, saved: 2000 }),
      ...PRICES.slice(1),
    ];
    render(<CollectionDetail collection={collection(prices)} />);
    const head = screen.getByTestId("size-price").textContent;
    expect(head).toContain("38,000₮");
    expect(head).toContain("40,000₮");
    expect(head).toContain("−5%");
    expect(head).toContain("/ 4 × 2ml");
  });

  describe("event countdown for the selected size (sale_event_bundles)", () => {
    const ENDS = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const prices = [
      price(2, 38000, true, { memberSum: 40000 }),
      price(5, 81000, true, {
        memberSum: 90000,
        eventSaving: 4500,
        nominalDiscountPct: 10,
      }),
      ...PRICES.slice(2),
    ];
    const c = collection(prices, {
      event: {
        slug: "bf",
        name: "Black Friday",
        pcts: { 5: 10 },
        endsAt: ENDS,
      },
    });

    it("shows only on a size the event discounts; marks that card", async () => {
      render(
        <FeatureFlagsProvider enabled={["sale_display", "sale_event_bundles"]}>
          <CollectionDetail collection={c} />
        </FeatureFlagsProvider>,
      );
      expect(screen.queryByRole("timer")).toBeNull();
      const five = screen.getByRole("radio", {
        name: "5ml ×4 — 10% хямдралтай",
      });
      await userEvent.click(five);
      expect(screen.getByRole("timer")).toBeTruthy();
      await userEvent.click(screen.getByRole("radio", { name: "2ml ×4" }));
      expect(screen.queryByRole("timer")).toBeNull();
    });

    it("flag sale_event_bundles off → no countdown", async () => {
      render(
        <FeatureFlagsProvider enabled={["sale_display"]}>
          <CollectionDetail collection={c} />
        </FeatureFlagsProvider>,
      );
      await userEvent.click(
        screen.getByRole("radio", { name: "5ml ×4 — 10% хямдралтай" }),
      );
      expect(screen.queryByRole("timer")).toBeNull();
    });
  });
});
