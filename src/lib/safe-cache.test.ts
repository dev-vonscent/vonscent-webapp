import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheResult = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock("next/cache", () => ({
  // The real cache is replaced by one that returns whatever the test set —
  // including the `undefined` an empty Data Cache entry yields.
  unstable_cache: () => async () => cacheResult.value,
}));

import { safeCache } from "./safe-cache";

describe("safeCache", () => {
  beforeEach(() => {
    cacheResult.value = undefined;
  });

  it("returns the cached value without calling the function", async () => {
    cacheResult.value = ["cached"];
    const fn = vi.fn(async () => ["fresh"]);
    await expect(safeCache(fn, ["k"], {})()).resolves.toEqual(["cached"]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps a cached null (a real «not found»)", async () => {
    cacheResult.value = null;
    const fn = vi.fn(async (_slug: string) => ({ slug: "x" }));
    await expect(safeCache(fn, ["k"], {})("x")).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("falls back to the function when the cache yields undefined", async () => {
    const fn = vi.fn(async (slug: string) => [slug]);
    await expect(safeCache(fn, ["k"], {})("a")).resolves.toEqual(["a"]);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("lets the fallback's error propagate (no empty value is invented)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("rpc down");
    });
    await expect(safeCache(fn, ["k"], {})()).rejects.toThrow("rpc down");
  });
});
