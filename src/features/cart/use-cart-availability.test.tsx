import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCart } from "./store";
import { useCartAvailability } from "./use-cart-availability";

vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

function line(productId: string, variantId: string) {
  return {
    productId,
    slug: productId,
    name: productId,
    brand: "B",
    variantId,
    ml: 10,
    unitPrice: 50000,
    image: null,
  };
}

function detail(id: string, variantIds: string[]) {
  return {
    id,
    soldOut: false,
    availableMl: 500,
    variants: variantIds.map((v) => ({
      id: v,
      ml: 10,
      price: 50000,
      isActive: true,
      sellable: true,
      unavailableReason: null,
    })),
  };
}

beforeEach(() => {
  useCart.getState().clear();
  useCart.getState().add(line("p1", "v1"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: (url: string) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("useCartAvailability", () => {
  it("хариунд ирээгүй бараа (нуугдсан/устсан) зарагдахгүй", async () => {
    stubFetch(async () => Response.json({ items: [] }));
    const { result } = renderHook(() => useCartAvailability());
    await waitFor(() =>
      expect(result.current.statusOf("v1")).toEqual({
        sellable: false,
        reason: "inactive",
      }),
    );
    expect(result.current.blockedItemKeys.has("v1")).toBe(true);
  });

  it("бараа ирсэн ч хэмжээ нь устсан бол зарагдахгүй", async () => {
    stubFetch(async () => Response.json({ items: [detail("p1", ["v5"])] }));
    const { result } = renderHook(() => useCartAvailability());
    await waitFor(() =>
      expect(result.current.statusOf("v1").sellable).toBe(false),
    );
  });

  it("байгаа хэмжээ хэвийн", async () => {
    const fetchFn = stubFetch(async () =>
      Response.json({ items: [detail("p1", ["v1"])] }),
    );
    const { result } = renderHook(() => useCartAvailability());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    await waitFor(() => expect(result.current.blockedItemKeys.size).toBe(0));
    expect(result.current.statusOf("v1").sellable).toBe(true);
  });

  it("сервер 503 бол түгжихгүй (fail-open)", async () => {
    const fetchFn = stubFetch(async () =>
      Response.json({ error: "unavailable" }, { status: 503 }),
    );
    const { result } = renderHook(() => useCartAvailability());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.statusOf("v1").sellable).toBe(true);
  });

  it("сүлжээ унасан бол түгжихгүй (fail-open)", async () => {
    const fetchFn = stubFetch(async () => {
      throw new TypeError("network");
    });
    const { result } = renderHook(() => useCartAvailability());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.statusOf("v1").sellable).toBe(true);
  });

  it("шинэ мөрийг хуучин хариугаар түгжихгүй", async () => {
    let release: () => void = () => {};
    stubFetch(async (url) => {
      if (url.includes("p2")) {
        // Шинэ id-уудын хариу хүлээгдэж байх үе.
        await new Promise<void>((r) => (release = r));
        return Response.json({
          items: [detail("p1", ["v1"]), detail("p2", ["v2"])],
        });
      }
      return Response.json({ items: [detail("p1", ["v1"])] });
    });
    const { result } = renderHook(() => useCartAvailability());
    await waitFor(() =>
      expect(result.current.statusOf("v1").sellable).toBe(true),
    );

    act(() => useCart.getState().add(line("p2", "v2")));
    // Хуучин хариунд v2 байхгүй ч энэ нь «алга» гэсэн үг биш.
    expect(result.current.statusOf("v2").sellable).toBe(true);
    expect(result.current.blockedItemKeys.has("v2")).toBe(false);

    await act(async () => release());
    await waitFor(() =>
      expect(result.current.statusOf("v2").sellable).toBe(true),
    );
  });
});
