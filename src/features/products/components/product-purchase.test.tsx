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

function product(
  variants: Variant[],
  availableMl = 100,
  tags: string[] = [],
): ProductDetail {
  return {
    id: "p1",
    tags,
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
  it("анхдагч хэмжээ = картын хэмжээ: 2ml хямдралгүй, 5ml хямдралтай → 5ml (2.5)", () => {
    const sale = [
      variant(2, 12_000),
      variant(5, 25_500, { basePrice: 30_000 }),
      variant(10, 50_000),
    ];
    render(<ProductPurchase product={product(sale, 100, ["sale"])} />);
    expect(
      screen.getByRole("radio", { name: /^5ml/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("хямдралгүй бол хамгийн жижиг зарагдах хэмжээ", () => {
    render(<ProductPurchase product={product(SIZES)} />);
    expect(
      screen.getByRole("radio", { name: /^2ml/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("card shows only the size and sprays — no price, no ₮/ml", () => {
    render(<ProductPurchase product={product(SIZES)} />);
    const five = screen.getByRole("radio", { name: "5ml" });
    // «цацалт» / «цац.» хоёулаа DOM-д — картын өргөнөөр CSS сонгоно (G).
    expect(five.textContent).toBe("5ml75 цацалт.");
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
      "30 цацалт, эрсдэлгүй туршилт",
    );

    await userEvent.click(screen.getByRole("radio", { name: /^5ml/ }));
    expect(head()).toContain("21,300₮");
    expect(head()).toContain("25,000₮");
    expect(head()).toContain("−15%");
    expect(screen.getByTestId("size-price-pct").className).toContain("bg-sale");
    expect(head()).toContain("/ 5ml");
    expect(screen.getByTestId("size-hint").textContent).toBe(
      "Цүнхэнд багтах, өдөр бүрийн хэмжээ",
    );
    const hint = screen.getByTestId("size-hint");
    expect(hint.getAttribute("data-kind")).toBe("pocket");
    expect(hint.querySelector("svg")).not.toBeNull();
    // Дарагддаггүй мэдээлэл: дэвсгэргүй, cursor/hover үгүй, өнгөт icon.
    expect(hint.getAttribute("data-look")).toBe("plain");
    expect(hint.className).not.toContain("bg-");
    expect(hint.className).toContain("cursor-default");
    expect(hint.className).not.toContain("hover:");
    expect(hint.querySelector("svg")?.getAttribute("class")).toContain(
      "text-gold-strong",
    );
  });

  it("hint row height is fixed by the longest hint of the page (all texts as invisible sizers)", async () => {
    render(<ProductPurchase product={product(SIZES)} />);
    const box = screen.getByTestId("size-hint-box");
    const sizers = [...box.querySelectorAll("[aria-hidden=true].invisible")];
    expect(sizers.map((n) => n.textContent)).toEqual([
      "30 цацалт, эрсдэлгүй туршилт",
      "Цүнхэнд багтах, өдөр бүрийн хэмжээ",
      "Аялалд, онгоцонд ч зөвшөөрөгдөнө",
      "Дуртай үнэртнээ хамгийн хямдаар, удаан хэрэглэ",
    ]);
    // Харагдах мөр нь сонгосон хэмжээнийх л, бусад нь зөвхөн өндрийн хэмжүүр.
    expect(screen.getByTestId("size-hint").textContent).toBe(
      "30 цацалт, эрсдэлгүй туршилт",
    );
    await userEvent.click(screen.getByRole("radio", { name: "20ml" }));
    expect(box.querySelectorAll("[aria-hidden=true].invisible")).toHaveLength(
      4,
    );
  });

  it("size cards align their label to the top (same line when one wraps)", () => {
    render(<ProductPurchase product={product(SIZES)} />);
    for (const r of screen.getAllByRole("radio")) {
      expect(r.className).toContain("justify-start");
      expect(r.className).not.toContain("justify-center");
    }
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
    const five = screen.getByRole("radio", { name: "5ml — 15% хямдралтай" });
    expect(five.getAttribute("data-sale")).toBe("true");
    // Бодит хувь starburst дотор.
    const burst = five.querySelector("[data-marker=burst]");
    expect(burst?.textContent).toBe("−15%");
    expect(burst?.querySelector("svg polygon")).not.toBeNull();
    // Бүх theme-д ижил `sale` token.
    expect(burst?.querySelector("svg")?.getAttribute("class")).toContain(
      "text-sale",
    );
    expect(burst?.querySelector("span")?.className).toContain(
      "text-sale-foreground",
    );
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
    // Дууссан хэмжээтэй бараанд тайлбарын мөрийн өндөр урьдчилан хадгалагдана.
    const note = screen.getByTestId("size-out-note");
    expect(note.textContent).toBe("");
    expect(note.className).toContain("min-h-8");
    const twenty = screen.getByRole("radio", { name: "20ml — Дууссан" });
    expect(twenty.textContent).toBe("20ml" + "Дууссан");
    await userEvent.click(twenty);
    expect(twenty.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("size-price").textContent).toContain("80,000₮");
    expect(screen.getByTestId("size-out-note").textContent).toContain(
      "түр дууссан",
    );
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

  it("price row keeps the same reserved height for every size of a sale product; none for a product without sale", async () => {
    const ends = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    const { unmount } = render(
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
    const row = () => screen.getByTestId("size-price").className;
    const at2 = row();
    expect(at2).toContain("max-sm:min-h-16");
    await userEvent.click(screen.getByRole("radio", { name: /^5ml/ }));
    // Pill үнийн мөрөн дотор, мөрийн class (өндөр) өөрчлөгдөхгүй.
    expect(
      screen.getByTestId("size-price").querySelector("[role=timer]"),
    ).not.toBeNull();
    expect(row()).toBe(at2);
    await userEvent.click(screen.getByRole("radio", { name: "2ml" }));
    expect(screen.queryByRole("timer")).toBeNull();
    expect(row()).toBe(at2);
    unmount();

    render(
      <FeatureFlagsProvider enabled={["sale_display"]}>
        <ProductPurchase product={product(SIZES)} />
      </FeatureFlagsProvider>,
    );
    expect(row()).not.toContain("min-h");
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

  it("qty ≥ 2 → total inside «Сагсанд нэмэх», no separate sum line; «Захиалах» stays plain", async () => {
    render(<ProductPurchase product={product(SIZES)} />);
    const cart = () =>
      screen.getAllByRole("button", { name: /Сагсанд нэмэх/ })[0];
    expect(cart().textContent).toBe("Сагсанд нэмэх");
    await userEvent.click(screen.getByRole("button", { name: "Нэмэх" }));
    expect(cart().textContent).toBe("Сагсанд нэмэх · 24,000₮");
    expect(screen.queryByText(/ш ×/)).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Захиалах" })[0].textContent,
    ).toBe("Захиалах");
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

describe("SizeSelector sale marker shapes", () => {
  it("pill хувилбар ч бодит хувьтай", async () => {
    const { SizeSelector } = await import("./size-selector");
    const { productSizeOptions } = await import("../size-options");
    const opts = productSizeOptions([
      variant(2, 12000),
      variant(5, 21300, { basePrice: 25000 }),
    ]);
    render(
      <SizeSelector
        options={opts}
        value={opts[0].id}
        onChange={() => {}}
        saleMarker="pill"
      />,
    );
    const five = screen.getByRole("radio", { name: "5ml — 15% хямдралтай" });
    const pill = five.querySelector("[data-marker=pill]");
    expect(pill?.textContent).toBe("−15%");
    expect(pill?.className).toContain("bg-sale");
  });
});

describe("SizeSelector — тэмдгийн дээд зай (4)", () => {
  it("тэмдэгтэй үед radiogroup дээр зай, тэмдэггүй бол үгүй", async () => {
    const { SizeSelector } = await import("./size-selector");
    const { productSizeOptions } = await import("../size-options");
    const marked = productSizeOptions([
      variant(2, 10000, { basePrice: 12000 }),
      variant(5, 25000),
    ]);
    const { unmount } = render(
      <SizeSelector
        options={marked}
        value={marked[0].id}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radiogroup").className).toContain("pt-2.5");
    unmount();
    const plain = productSizeOptions([variant(2, 12000), variant(5, 25000)]);
    render(
      <SizeSelector options={plain} value={plain[0].id} onChange={() => {}} />,
    );
    expect(screen.getByRole("radiogroup").className).not.toContain("pt-");
  });
});
