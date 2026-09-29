import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { OrderLines } from "./order-lines";
import {
  useCart,
  type CartCollection,
  type CartItem,
} from "@/features/cart/store";
import { useCheckoutLines } from "@/features/cart/use-cart-selection";

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
 * Төлбөрийн хуудаснаас мөрөө засах (клиент, 2026-09 UG): урьд нь тоо, хэмжээ
 * солих, устгах боломжгүй тул хэрэглэгч буцаж, сагсаа эхнээс нь бүрдүүлдэг
 * байв. Засвар бүр сагсны store руу ШУУД бичигдэнэ — буцахад сагс ижил.
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
  });

  it("changes a cart line's qty in the cart itself", async () => {
    const line = input(item());
    useCart.getState().add(line, 1);
    render(<Live />);
    await userEvent.click(
      screen.getByRole("button", { name: "Aventus — нэгээр нэмэх" }),
    );
    expect(useCart.getState().items[0].qty).toBe(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Aventus — нэгээр хасах" }),
    );
    expect(useCart.getState().items[0].qty).toBe(1);
  });

  it("removes a cart line from the cart", async () => {
    const line = input(item());
    useCart.getState().add(line, 1);
    render(<Live />);
    await userEvent.click(
      screen.getByRole("button", { name: "Aventus — устгах" }),
    );
    expect(useCart.getState().items).toEqual([]);
  });

  it("edits a bundle's qty and can remove it", async () => {
    const b = input(bundle());
    useCart.getState().addCollection(b, 1);
    render(<Live />);
    await userEvent.click(
      screen.getByRole("button", { name: "Зуны багц — нэгээр нэмэх" }),
    );
    expect(useCart.getState().collections[0].qty).toBe(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Зуны багц — устгах" }),
    );
    expect(useCart.getState().collections).toEqual([]);
  });

  it("edits the «Захиалах» line without touching the cart", async () => {
    const cartLine = input(item({ variantId: "c1" }));
    useCart.getState().add({ ...cartLine, name: "In cart" }, 1);
    const line = input(item());
    useCart.getState().startBuyNow(line, 1);
    render(<Live />);
    await userEvent.click(
      screen.getByRole("button", { name: "Aventus — нэгээр нэмэх" }),
    );
    expect(useCart.getState().buyNow).toMatchObject({ item: { qty: 2 } });
    expect(useCart.getState().items.map((i) => i.qty)).toEqual([1]);
    // Ганц мөрийг хасвал checkout сагсны мөрүүд рүү чимээгүй шилжинэ —
    // тиймээс «Захиалах» мөрөнд устгах товч байхгүй.
    expect(
      screen.queryByRole("button", { name: "Aventus — устгах" }),
    ).toBeNull();
  });
});
