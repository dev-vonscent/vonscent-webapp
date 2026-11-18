import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductDetail, Variant } from "@/lib/types";
import { FeatureFlagsProvider } from "@/components/feature-flags";

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
    bottleLocked: false,
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
  it("card shows only the size and ≈ sprays — no price, no ₮/ml", () => {
    render(<ProductPurchase product={product(SIZES)} />);
    const five = screen.getByRole("radio", { name: "5ml" });
    expect(five.textContent).toBe("5ml≈ 75 цацалт");
    expect(five.textContent).not.toMatch(/₮/);
  });

  it("selected size drives the price header and the hint below", async () => {
    render(
      <ProductPurchase
        product={product([
          variant(2, 12000),
          variant(5, 21300, { basePrice: 25000 }),
          ...SIZES.slice(2),
        ])}
      />,
    );
    const head = () => screen.getByTestId("size-price").textContent;
    expect(head()).toContain("12,000₮");
    expect(head()).not.toMatch(/−\d+%/);
    expect(screen.getByTestId("size-hint").textContent).toBe(
      "Туршиж үзэхэд тохиромжтой",
    );

    await userEvent.click(screen.getByRole("radio", { name: /^5ml/ }));
    expect(head()).toContain("21,300₮");
    expect(head()).toContain("25,000₮");
    expect(head()).toContain("−15%");
    expect(head()).toContain("/ 5ml");
    expect(screen.getByTestId("size-hint").textContent).toBe(
      "Халаасанд багтахуйц",
    );
  });

  it("marks discounted sizes on the card", () => {
    render(
      <ProductPurchase
        product={product([
          variant(2, 12000),
          variant(5, 21300, { basePrice: 25000 }),
          ...SIZES.slice(2),
        ])}
      />,
    );
    const five = screen.getByRole("radio", { name: "5ml — хямдралтай" });
    expect(five.getAttribute("data-sale")).toBe("true");
    expect(
      screen.getByRole("radio", { name: "2ml" }).getAttribute("data-sale"),
    ).toBeNull();
  });

  it("sold-out size: selectable, shows its price, buy buttons disabled «Дууссан»", async () => {
    const out = {
      inStock: false,
      sellable: false,
      unavailableReason: "stock" as const,
    };
    render(
      <ProductPurchase
        product={product([...SIZES.slice(0, 3), variant(20, 80000, out)])}
      />,
    );
    // Анхдагч нь дууссан биш, зарагдах эхний хэмжээ.
    expect(
      screen.getByRole("radio", { name: "2ml" }).getAttribute("aria-checked"),
    ).toBe("true");
    const twenty = screen.getByRole("radio", { name: "20ml — Дууссан" });
    expect(twenty.textContent).toBe("20ml" + "Дууссан");
    await userEvent.click(twenty);
    expect(twenty.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("size-price").textContent).toContain("80,000₮");
    const buy = screen.getByRole("button", { name: "Дууссан" });
    expect((buy as HTMLButtonElement).disabled).toBe(true);
    // Хуудсан доторх товч (доод наалддаг зурвас нь энэ үед харагдахгүй).
    const cart = screen.getAllByRole("button", { name: /Сагсанд нэмэх/ })[0];
    expect((cart as HTMLButtonElement).disabled).toBe(true);
  });

  it("radiogroup: arrow keys move the selection and skip unsellable-by-admin sizes", async () => {
    render(
      <ProductPurchase
        product={product([
          variant(2, 12000),
          variant(5, 25000, {
            isActive: false,
            sellable: false,
            unavailableReason: "inactive",
          }),
          variant(10, 45000),
          variant(20, 80000),
        ])}
      />,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Хэмжээ сонгох" }),
    ).toBeTruthy();
    const two = screen.getByRole("radio", { name: "2ml" });
    expect(two.tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "10ml" }).tabIndex).toBe(-1);
    two.focus();
    await userEvent.keyboard("{ArrowRight}");
    const ten = screen.getByRole("radio", { name: "10ml" });
    expect(ten.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(ten);
    await userEvent.keyboard("{End}");
    expect(
      screen.getByRole("radio", { name: "20ml" }).getAttribute("aria-checked"),
    ).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    expect(two.getAttribute("aria-checked")).toBe("true");
    // «Зарахгүй» дээр дарахад сонголт өөрчлөгдөхгүй.
    await userEvent.click(
      screen.getByRole("radio", { name: "5ml — Зарахгүй" }),
    );
    expect(two.getAttribute("aria-checked")).toBe("true");
  });

  it("countdown follows the selected size; hidden on a size without a sale", async () => {
    const ends = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    render(
      <FeatureFlagsProvider enabled={["sale_display"]}>
        <ProductPurchase
          product={product([
            variant(2, 12000),
            variant(5, 21300, { basePrice: 25000, saleEndsAt: ends }),
            ...SIZES.slice(2),
          ])}
        />
      </FeatureFlagsProvider>,
    );
    expect(screen.queryByRole("timer")).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: /^5ml/ }));
    expect(screen.getByRole("timer")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "10ml" }));
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("no countdown when sale_display is off", async () => {
    const ends = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    render(
      <ProductPurchase
        product={product([
          variant(5, 21300, { basePrice: 25000, saleEndsAt: ends }),
        ])}
      />,
    );
    expect(screen.queryByRole("timer")).toBeNull();
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
