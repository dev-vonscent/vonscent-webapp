import { beforeEach, describe, expect, it } from "vitest";
import {
  useCart,
  selectCount,
  selectSubtotal,
  selectSelectedCount,
  selectCheckoutItems,
  selectCheckoutCollections,
  selectCheckoutSubtotal,
} from "./store";

const line = (variantId: string, unitPrice: number) => ({
  productId: `p-${variantId}`,
  slug: `s-${variantId}`,
  name: `N ${variantId}`,
  brand: "B",
  variantId,
  ml: 5,
  unitPrice,
  image: null,
});

const bundle = (collectionId: string, unitPrice: number) => ({
  collectionId,
  type: "base" as const,
  slug: `c-${collectionId}`,
  name: `C ${collectionId}`,
  image: null,
  discountPct: 10,
  ml: 5,
  members: [],
  unitPrice,
});

/**
 * Сагснаас хүссэн барааг л захиалдаг тул мөр тус бүр чагттай. Сонголтыг
 * "хассан мөрүүд" хэлбэрээр хадгалдаг нь эндээс шалгагдаж байгаа зан
 * төлөвийг л зорьсон: шинэ мөр сонгогдсон, дүн зөвхөн сонгосноор бодогдох,
 * захиалга үлдсэн барааг сагсанд хөндөхгүй.
 */
describe("cart selection", () => {
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

  it("selects a newly added line", () => {
    useCart.getState().add(line("v1", 10000));
    expect(useCart.getState().excludedItems).toEqual([]);
    expect(selectSubtotal(useCart.getState())).toBe(10000);
  });

  it("keeps an unchecked line out of the payable subtotal", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().add(line("v2", 5000), 2);
    useCart.getState().setItemSelected("v2", false);

    expect(selectSubtotal(useCart.getState())).toBe(10000);
    // Толгойн badge нь сагсанд байгаа бүх барааг тоолсоор байна.
    expect(selectCount(useCart.getState())).toBe(3);
    expect(selectSelectedCount(useCart.getState())).toBe(1);
  });

  it("re-checks a line that is added again", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().setItemSelected("v1", false);
    useCart.getState().add(line("v1", 10000));
    expect(useCart.getState().excludedItems).toEqual([]);
  });

  it("carries the checkbox across a size swap", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().setItemSelected("v1", false);
    useCart
      .getState()
      .setVariant("v1", { variantId: "v9", ml: 10, unitPrice: 18000 });

    expect(useCart.getState().excludedItems).toEqual(["v9"]);
    expect(selectSubtotal(useCart.getState())).toBe(0);
  });

  it("drops the exclusion when the line is removed", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().setItemSelected("v1", false);
    useCart.getState().remove("v1");
    expect(useCart.getState().excludedItems).toEqual([]);
  });

  it("toggles every line, bundles included", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().addCollection(bundle("c1", 40000));

    useCart.getState().setAllSelected(false);
    expect(selectSubtotal(useCart.getState())).toBe(0);

    useCart.getState().setAllSelected(true);
    expect(selectSubtotal(useCart.getState())).toBe(50000);
  });

  it("removes only the ordered lines and leaves the rest in the cart", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().add(line("v2", 5000));
    useCart.getState().addCollection(bundle("c1", 40000));
    useCart.getState().setItemSelected("v2", false);
    useCart.getState().setCoupon({ code: "X", discount: 1000 });

    useCart.getState().removeSelected();

    const state = useCart.getState();
    expect(state.items.map((i) => i.key)).toEqual(["v2"]);
    expect(state.collections).toEqual([]);
    // «v2» хасагдсан хэвээр — захиалгын дараа ч чагтлагдаагүй байна.
    expect(state.excludedItems).toEqual(["v2"]);
    expect(selectSubtotal(state)).toBe(0);
    // Купон нь захиалсан дүн дээр батлагдсан тул үлдсэн сагсанд дагахгүй.
    expect(state.coupon).toBeNull();
  });
});

/**
 * «Захиалах» товч бол Buy Now — салбарын хэмжээнд «сагсыг тойрч, зөвхөн энэ
 * бараа» гэсэн утгатай (Amazon, Shopify). Тиймээс мөр нь сагсанд ордоггүй,
 * тусдаа `buyNow` талбарт сууна: дахин дархад тоо ширхэг өсөхгүй, сагсанд
 * хэвтэж байсан бараа дагаж төлөгдөхгүй, захиалахаа больсон ч сагс хэвээрээ.
 */
describe("buy now", () => {
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

  it("never touches the cart", () => {
    useCart.getState().add(line("v1", 10000));

    useCart.getState().startBuyNow(line("v2", 5000));

    const state = useCart.getState();
    // Сагс дарахын өмнөх хэвээрээ — «v2» түүн дотор алга.
    expect(state.items.map((i) => i.key)).toEqual(["v1"]);
    expect(selectCount(state)).toBe(1);
    expect(selectSubtotal(state)).toBe(10000);
  });

  it("takes only the bought line to checkout", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().addCollection(bundle("c1", 40000));

    useCart.getState().startBuyNow(line("v2", 5000), 2);

    const state = useCart.getState();
    expect(selectCheckoutItems(state).map((i) => i.key)).toEqual(["v2"]);
    expect(selectCheckoutCollections(state)).toEqual([]);
    expect(selectCheckoutSubtotal(state)).toBe(10000);
  });

  it("does not stack up when pressed twice", () => {
    useCart.getState().startBuyNow(line("v1", 10000));
    useCart.getState().startBuyNow(line("v1", 10000));

    expect(selectCheckoutItems(useCart.getState())[0].qty).toBe(1);
    expect(selectCheckoutSubtotal(useCart.getState())).toBe(10000);
  });

  it("takes only the bought bundle to checkout", () => {
    useCart.getState().add(line("v1", 10000));

    useCart.getState().startBuyNowCollection(bundle("c1", 40000));

    const state = useCart.getState();
    expect(state.collections).toEqual([]);
    expect(selectCheckoutItems(state)).toEqual([]);
    expect(selectCheckoutCollections(state).map((c) => c.key)).toEqual([
      "c1:5",
    ]);
    expect(selectCheckoutSubtotal(state)).toBe(40000);
  });

  it("falls back to the checked cart lines once it is cleared", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().startBuyNow(line("v2", 5000));

    useCart.getState().clearBuyNow();

    const state = useCart.getState();
    expect(selectCheckoutItems(state).map((i) => i.key)).toEqual(["v1"]);
    expect(selectCheckoutSubtotal(state)).toBe(10000);
  });

  it("drops the line when the order goes through, cart untouched", () => {
    useCart.getState().add(line("v1", 10000));
    useCart.getState().startBuyNow(line("v2", 5000));
    useCart.getState().setCoupon({ code: "X", discount: 1000 });

    useCart.getState().clearOrdered();

    const state = useCart.getState();
    expect(state.buyNow).toBeNull();
    // Захиалсан нь сагсныхан биш тул «v1» хэвээрээ.
    expect(state.items.map((i) => i.key)).toEqual(["v1"]);
    expect(state.coupon).toBeNull();
  });

  it("drops a line that the server reports as unavailable", () => {
    useCart.getState().startBuyNow(line("v1", 10000));

    useCart.getState().remove("v1");

    expect(useCart.getState().buyNow).toBeNull();
  });
});
