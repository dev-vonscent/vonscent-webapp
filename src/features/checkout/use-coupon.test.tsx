import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));

import { useCoupon } from "./use-coupon";
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

  it("asks for available coupons only while none is applied", async () => {
    const fetchMock = mockFetch(() => ({
      coupons: [
        {
          code: "WHEEL5",
          type: "percent",
          value: 5,
          discount: 1500,
          minSubtotal: 0,
          endsAt: null,
          personal: true,
        },
      ],
    }));

    const { result } = renderHook(() => useCoupon(30000));
    await waitFor(() => expect(result.current.offers).toHaveLength(1));
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("available")),
    ).toBe(true);
  });
});
