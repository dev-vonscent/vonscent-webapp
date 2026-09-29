import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));

import { bestOffer, useCoupon } from "./use-coupon";
import { useCart } from "@/features/cart/store";

/** Хариулт бүрийг URL-аар нь салгаж буцаадаг fetch mock. */
function mockFetch(
  handler: (url: string, body: Record<string, unknown>) => unknown,
) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () =>
      handler(url, init?.body ? JSON.parse(String(init.body)) : {}),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useCoupon", () => {
  beforeEach(() => {
    useCart.setState({
      items: [],
      collections: [],
      excludedItems: [],
      excludedCollections: [],
      coupon: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the code and discount the server returns", async () => {
    mockFetch((url) =>
      url.includes("validate")
        ? { valid: true, code: "SALE10", discount: 3000 }
        : { coupons: [] },
    );

    const { result } = renderHook(() => useCoupon(30000));
    await result.current.apply("sale10");

    await waitFor(() =>
      expect(useCart.getState().coupon).toEqual({
        code: "SALE10",
        discount: 3000,
      }),
    );
  });

  it("uses the typed code when handed a click event instead", async () => {
    mockFetch((url, body) =>
      url.includes("validate")
        ? { valid: true, code: String(body.code).toUpperCase(), discount: 3000 }
        : { coupons: [] },
    );

    const { result } = renderHook(() => useCoupon(30000));
    act(() => result.current.setCode("sale10"));
    await act(() => result.current.apply({ type: "click" }));

    expect(useCart.getState().coupon?.code).toBe("SALE10");
  });

  it("refreshes a discount that went stale when the cart changed", async () => {
    // 10% купон: 30,000₮ дээр 3,000₮ байсан нь 50,000₮ дээр 5,000₮ болно.
    mockFetch((url, body) =>
      url.includes("validate")
        ? {
            valid: true,
            code: "SALE10",
            discount: Math.round(Number(body.subtotal) * 0.1),
          }
        : { coupons: [] },
    );
    useCart.setState({ coupon: { code: "SALE10", discount: 3000 } });

    const { rerender } = renderHook(({ sum }) => useCoupon(sum), {
      initialProps: { sum: 50000 },
    });
    rerender({ sum: 50000 });

    await waitFor(() => expect(useCart.getState().coupon?.discount).toBe(5000));
  });

  it("drops a coupon the cart no longer qualifies for, and says why", async () => {
    mockFetch((url) =>
      url.includes("validate")
        ? {
            valid: false,
            discount: 0,
            message: "Захиалгын дүн хүрэхгүй байна.",
          }
        : { coupons: [] },
    );
    useCart.setState({ coupon: { code: "SALE10", discount: 3000 } });

    const { result } = renderHook(() => useCoupon(5000));

    await waitFor(() => expect(useCart.getState().coupon).toBeNull());
    expect(result.current.message).toBe("Захиалгын дүн хүрэхгүй байна.");
  });

  it("never shows a discount larger than the subtotal", () => {
    useCart.setState({ coupon: { code: "BIG", discount: 90000 } });
    const { result } = renderHook(() => useCoupon(10000));
    expect(result.current.discount).toBe(10000);
  });

  it("keeps asking for offers while a coupon is applied, so it can be swapped", async () => {
    const fetchMock = mockFetch((url) =>
      url.includes("validate")
        ? { valid: true, code: "SALE10", discount: 3000 }
        : { coupons: [offerJson({ code: "WHEEL5", discount: 1500 })] },
    );
    useCart.setState({ coupon: { code: "SALE10", discount: 3000 } });

    const { result } = renderHook(() => useCoupon(30000));
    await waitFor(() => expect(result.current.offers).toHaveLength(1));
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("available")),
    ).toBe(true);
  });
});

function offerJson(over: Record<string, unknown> = {}) {
  return {
    id: over.code ?? "C1",
    code: "C1",
    type: "percent",
    value: 5,
    discount: 1500,
    minSubtotal: 0,
    maxDiscount: null,
    eligible: true,
    shortfall: 0,
    endsAt: null,
    personal: true,
    ...over,
  };
}

describe("bestOffer", () => {
  it("picks the biggest usable saving, the earliest one on a tie", () => {
    const offers = [
      offerJson({ code: "A", discount: 3000 }),
      offerJson({ code: "B", discount: 9000 }),
      offerJson({ code: "C", discount: 9000 }),
      offerJson({ code: "D", discount: 20000, eligible: false }),
    ] as never[];
    expect(bestOffer(offers)?.code).toBe("B");
    expect(bestOffer([])).toBeNull();
  });
});

describe("useCoupon · autoPickBest", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useCart.setState({
      items: [],
      collections: [],
      excludedItems: [],
      excludedCollections: [],
      coupon: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const OFFERS = [
    offerJson({ code: "SMALL", discount: 3000 }),
    offerJson({ code: "BIG", discount: 24420 }),
  ];

  function serve() {
    return mockFetch((url, body) =>
      url.includes("validate")
        ? {
            valid: true,
            code: body.code,
            discount: OFFERS.find((o) => o.code === body.code)?.discount ?? 0,
          }
        : { coupons: OFFERS },
    );
  }

  it("applies the biggest saving on its own", async () => {
    serve();
    const { result } = renderHook(() =>
      useCoupon(244200, { autoPickBest: true }),
    );
    await waitFor(() =>
      expect(useCart.getState().coupon).toEqual({
        code: "BIG",
        discount: 24420,
      }),
    );
    expect(result.current.autoApplied).toBe(true);
    expect(result.current.discount).toBe(24420);
  });

  it("respects a coupon already brought from the cart", async () => {
    serve();
    useCart.setState({ coupon: { code: "SMALL", discount: 3000 } });
    const { result } = renderHook(() =>
      useCoupon(244200, { autoPickBest: true }),
    );
    await waitFor(() => expect(result.current.offers).toHaveLength(2));
    expect(useCart.getState().coupon?.code).toBe("SMALL");
    expect(result.current.autoApplied).toBe(false);
  });

  it("does not put back a coupon the customer removed", async () => {
    serve();
    const first = renderHook(() => useCoupon(244200, { autoPickBest: true }));
    await waitFor(() => expect(useCart.getState().coupon?.code).toBe("BIG"));
    first.result.current.clear();
    await waitFor(() => expect(useCart.getState().coupon).toBeNull());
    first.unmount();

    // Хуудсыг дахин ачаалсантай адил — шинэ mount.
    const again = renderHook(() => useCoupon(244200, { autoPickBest: true }));
    await waitFor(() => expect(again.result.current.offers).toHaveLength(2));
    expect(useCart.getState().coupon).toBeNull();
  });

  it("stays off unless asked for", async () => {
    serve();
    const { result } = renderHook(() => useCoupon(244200));
    await waitFor(() => expect(result.current.offers).toHaveLength(2));
    expect(useCart.getState().coupon).toBeNull();
  });
});
