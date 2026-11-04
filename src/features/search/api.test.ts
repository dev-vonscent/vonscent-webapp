import { beforeEach, describe, expect, it, vi } from "vitest";

const callRpc = vi.fn();
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({}) }));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));

import { globalSearch, searchLimits } from "./api";

function rows(kind: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    kind,
    id: `${kind}-${i}`,
    slug: `${kind}-${i}`,
    title: `${kind} ${i}`,
    subtitle: null,
    image_url: null,
    price: null,
    sold_out: false,
    item_count: null,
    member_images: null,
  }));
}

describe("searchLimits", () => {
  it("defaults to 12 products and 5 of everything else", () => {
    expect(searchLimits()).toEqual({ product: 12, other: 5 });
  });

  it("an explicit limit applies to every kind, clamped to 1…20", () => {
    expect(searchLimits(3)).toEqual({ product: 3, other: 3 });
    expect(searchLimits(0)).toEqual({ product: 1, other: 1 });
    expect(searchLimits(50)).toEqual({ product: 20, other: 20 });
  });
});

describe("globalSearch limits", () => {
  beforeEach(() => callRpc.mockReset());

  it("keeps up to 12 products but only 5 collections / brands", async () => {
    callRpc.mockResolvedValue({
      data: [
        ...rows("product", 12),
        ...rows("collection", 12),
        ...rows("brand", 12),
      ],
      error: null,
    });
    const r = await globalSearch("dior");
    expect(callRpc.mock.calls[0]?.[2]).toMatchObject({ p_limit: 12 });
    expect(r.product).toHaveLength(12);
    expect(r.collection).toHaveLength(5);
    expect(r.brand).toHaveLength(5);
  });

  it("an explicit limit caps every kind the same", async () => {
    callRpc.mockResolvedValue({
      data: [...rows("product", 3), ...rows("collection", 3)],
      error: null,
    });
    const r = await globalSearch("dior", 3);
    expect(callRpc.mock.calls[0]?.[2]).toMatchObject({ p_limit: 3 });
    expect(r.product).toHaveLength(3);
    expect(r.collection).toHaveLength(3);
  });
});
