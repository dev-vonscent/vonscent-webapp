import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderLines } from "./order-lines";
import {
  useCart,
  type CartCollection,
  type CartItem,
} from "@/features/cart/store";
import { useCheckoutLines } from "@/features/cart/use-cart-selection";
import { toast } from "@/lib/toast";

vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

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

/**
 * Төлбөрийн хуудаснаас мөрөө засах (клиент, 2026-09 UG): тойм зөвхөн уншина,
 * засвар нь «Засах» dialog-д. Өөрчлөлт «Хадгалах» дарахад л сагс руу очно.
 */
/** Сагсны `add` / `addCollection`-д өгөх хэлбэр (key, qty-гүй). */
function input<T extends { key: string; qty: number }>(
  line: T,
): Omit<T, "key" | "qty"> {
  const copy: Partial<T> = { ...line };
  delete copy.key;
  delete copy.qty;
  return copy as Omit<T, "key" | "qty">;
}

/** `/api/products?details=1`-ийн p1: 10ml (v1) ба 5ml (v5) хэмжээтэй. */
function productDetail(availableMl: number) {
  return {
    id: "p1",
    soldOut: false,
    availableMl,
    variants: [
      {
        id: "v5",
        ml: 5,
        price: 30000,
        isActive: true,
        sellable: availableMl >= 5,
        unavailableReason: availableMl >= 5 ? null : "stock",
      },
      {
        id: "v1",
        ml: 10,
        price: 50000,
        isActive: true,
        sellable: availableMl >= 10,
        unavailableReason: availableMl >= 10 ? null : "stock",
      },
    ],
  };
}

/** Багц b1-ийн (гишүүн p2) серверийн үнэлгээ — 5ml ба 10ml. */
const QUOTE = {
  sizes: [
    {
      ml: 2,
      available: false,
      price: 0,
      memberSum: 0,
      discountPct: 0,
      members: [],
    },
    {
      ml: 5,
      available: true,
      price: 27000,
      memberSum: 30000,
      discountPct: 10,
      members: [{ productId: "p2", variantId: "m1", price: 30000 }],
    },
    {
      ml: 10,
      available: true,
      price: 45000,
      memberSum: 50000,
      discountPct: 10,
      members: [{ productId: "p2", variantId: "m10", price: 50000 }],
    },
    {
      ml: 20,
      available: false,
      price: 0,
      memberSum: 0,
      discountPct: 0,
      members: [],
    },
  ],
  stock: { p2: 100 },
};

function stubApi(availableMl = 100) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).startsWith("/api/collections/quote")
        ? Response.json(QUOTE)
        : Response.json({ items: [productDetail(availableMl)] }),
    ),
  );
}

describe("OrderLines editable", () => {
  function Live() {
    // Хуудастай ижил hook — мөрүүд нь memo-той.
    const { items, collections, buyNow } = useCheckoutLines();
    return (
      <OrderLines
        items={items}
        collections={collections}
        editable
        buyNow={buyNow}
      />
    );
  }

  beforeEach(() => {
    useCart.setState({
      items: [],
      collections: [],
      buyNow: null,
      excludedItems: [],
      excludedCollections: [],
      coupon: null,
    });
    stubApi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(toast).mockClear();
  });

  async function openEditor(name: string) {
    await userEvent.click(
      screen.getByRole("button", { name: `${name} — засах` }),
    );
    const dialog = await screen.findByRole("dialog");
    // Хэмжээ ачаалагдаж дуусах хүртэл.
    await waitFor(() =>
      expect(within(dialog).getAllByRole("radio").length).toBeGreaterThan(0),
    );
    return dialog;
  }

  it("keeps the summary read-only — edits live behind «Засах»", () => {
    useCart.getState().add(input(item()), 2);
    render(<Live />);
    expect(screen.getByText("Creed · 10ml")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /нэмэх/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /устгах/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Aventus — засах" }),
    ).toBeTruthy();
  });

  it("writes qty to the cart only on «Хадгалах»", async () => {
    useCart.getState().add(input(item()), 1);
    render(<Live />);
    const dialog = await openEditor("Aventus");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Нэгээр нэмэх" }),
    );
    expect(useCart.getState().items[0].qty).toBe(1);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Хадгалах" }),
    );
    expect(useCart.getState().items[0].qty).toBe(2);
  });

  it("discards the draft when closed", async () => {
    useCart.getState().add(input(item()), 1);
    render(<Live />);
    const dialog = await openEditor("Aventus");
    await userEvent.click(within(dialog).getByRole("radio", { name: /5ml/ }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Нэгээр нэмэх" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(useCart.getState().items[0]).toMatchObject({
      variantId: "v1",
      qty: 1,
    });
  });

  it("swaps a line's size at the server's price", async () => {
    useCart.getState().add(input(item()), 1);
    render(<Live />);
    const dialog = await openEditor("Aventus");
    await userEvent.click(within(dialog).getByRole("radio", { name: /5ml/ }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Хадгалах" }),
    );
    expect(useCart.getState().items).toEqual([
      expect.objectContaining({
        key: "v5",
        variantId: "v5",
        ml: 5,
        unitPrice: 30000,
        qty: 1,
      }),
    ]);
  });

  it("stops at the stock and says why, in the dialog", async () => {
    // 25ml үлдэгдэл, 10ml → 2 ширхэг хүртэл.
    stubApi(25);
    useCart.getState().add(input(item()), 1);
    render(<Live />);
    const dialog = await openEditor("Aventus");
    const plus = within(dialog).getByRole("button", { name: "Нэгээр нэмэх" });
    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(plus.getAttribute("aria-disabled")).toBe("true");
    expect(
      within(dialog).getByText(
        "Үлдэгдэл хомс — 10ml-ээр 2 ш л авах боломжтой.",
      ),
    ).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Хадгалах" }),
    );
    expect(useCart.getState().items[0].qty).toBe(2);
  });

  it("lowers the qty when a bigger size fits fewer", async () => {
    stubApi(20);
    useCart
      .getState()
      .add(
        input(item({ key: "v5", variantId: "v5", ml: 5, unitPrice: 30000 })),
        3,
      );
    render(<Live />);
    const dialog = await openEditor("Aventus");
    await userEvent.click(within(dialog).getByRole("radio", { name: /10ml/ }));
    expect(
      within(dialog).getByText(
        "10ml-ээр 2 ш л авах боломжтой тул тоог багасгалаа.",
      ),
    ).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Хадгалах" }),
    );
    expect(useCart.getState().items[0]).toMatchObject({ ml: 10, qty: 2 });
  });

  it("removes a cart line from the dialog", async () => {
    useCart.getState().add(input(item()), 1);
    render(<Live />);
    const dialog = await openEditor("Aventus");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Устгах/ }),
    );
    expect(useCart.getState().items).toEqual([]);
  });

  it("moves a bundle to another size, repriced by the server", async () => {
    useCart.getState().addCollection(input(bundle()), 1);
    render(<Live />);
    const dialog = await openEditor("Зуны багц");
    expect(within(dialog).getByText("Neroli Portofino")).toBeTruthy();
    expect(
      within(dialog)
        .getByRole("radio", { name: /2ml/ })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(within(dialog).getByRole("radio", { name: /10ml/ }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Нэгээр нэмэх" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Хадгалах" }),
    );
    const [c] = useCart.getState().collections;
    expect(c).toMatchObject({
      key: "c1:10",
      ml: 10,
      qty: 2,
      unitPrice: 45000,
      members: [
        expect.objectContaining({
          variantId: "m10",
          price: 50000,
          name: "Neroli Portofino",
        }),
      ],
    });
  });

  it("edits the «Захиалах» line without touching the cart", async () => {
    useCart
      .getState()
      .add({ ...input(item({ variantId: "c1" })), name: "In cart" }, 1);
    useCart.getState().startBuyNow(input(item()), 1);
    render(<Live />);
    const dialog = await openEditor("Aventus");
    // Ганц мөрийг хасвал checkout сагсны мөрүүд рүү чимээгүй шилжинэ.
    expect(within(dialog).queryByRole("button", { name: /Устгах/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole("radio", { name: /5ml/ }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Хадгалах" }),
    );
    expect(useCart.getState().buyNow).toMatchObject({
      item: { variantId: "v5", ml: 5, unitPrice: 30000, qty: 1 },
    });
    expect(useCart.getState().items.map((i) => i.name)).toEqual(["In cart"]);
  });

  it("lowers a «Захиалах» qty the stock no longer covers", async () => {
    stubApi(15);
    useCart.getState().startBuyNow(input(item()), 3);
    render(<Live />);
    await waitFor(() =>
      expect(useCart.getState().buyNow).toMatchObject({ item: { qty: 1 } }),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Aventus 10ml → 1 ш"),
      "Захиалга шинэчлэгдлээ",
    );
  });
});
