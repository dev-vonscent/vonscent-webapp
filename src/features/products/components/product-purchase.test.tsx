import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductDetail, Variant } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({
  trackAddToCart: vi.fn(),
  trackBeginCheckout: vi.fn(),
}));
const toast = vi.fn();
vi.mock("@/lib/toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { ProductPurchase } from "./product-purchase";
import { useCart } from "@/features/cart/store";

function variant(
  ml: number,
  price: number,
  over: Partial<Variant> = {},
): Variant {
  return {
    id: `v${ml}`,
    ml,
    price,
    basePrice: price,
    isActive: true,
    inStock: true,
    sellable: true,
    unavailableReason: null,
    ...over,
  } as Variant;
}

function product(variants: Variant[], availableMl = 100): ProductDetail {
  return {
    id: "p1",
    slug: "aventus",
    name: "Aventus",
    brand: "Creed",
    soldOut: false,
    image: null,
    variants,
    availableMl,
  } as unknown as ProductDetail;
}

const SIZES = [
  variant(2, 12000),
  variant(5, 25000),
  variant(10, 45000),
  variant(20, 80000),
];

beforeEach(() => {
  toast.mockClear();
  useCart.setState({ items: [], collections: [] });
});

describe("ProductPurchase", () => {
  it("keeps «Хамгийн ашигтай» on 20ml even when 20ml is sold out", () => {
    render(
      <ProductPurchase
        product={product([
          ...SIZES.slice(0, 3),
          variant(20, 80000, {
            inStock: false,
            sellable: false,
            unavailableReason: "stock",
          }),
        ])}
      />,
    );
    const badge = screen.getByText("Хамгийн ашигтай");
    expect(badge.closest("button")?.getAttribute("aria-label")).toBe(
      "20ml — дууссан",
    );
  });

  it("labels the 2ml size «Туршиж үзэх»", () => {
    render(<ProductPurchase product={product(SIZES)} />);
    expect(
      screen
        .getByText("Туршиж үзэх")
        .closest("button")
        ?.getAttribute("aria-label"),
    ).toBe("2ml");
  });

  it("warns «Үлдэгдэл хомс» when + is pressed at the stock limit", async () => {
    // 12ml үлдэгдэл, 2ml сонгосон → 6 ширхэг хүртэл.
    render(<ProductPurchase product={product(SIZES, 12)} />);
    const plus = screen.getByRole("button", { name: "Нэмэх" });
    for (let i = 0; i < 5; i += 1) await userEvent.click(plus);
    expect(toast).not.toHaveBeenCalled();
    expect(plus.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(plus);
    expect(toast).toHaveBeenCalledWith(
      "2ml-ээс 6 ш л авах боломжтой.",
      "Үлдэгдэл хомс",
    );
    expect(screen.getByText("6")).toBeTruthy();
  });
});
