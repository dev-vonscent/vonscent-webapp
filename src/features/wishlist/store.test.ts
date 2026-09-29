import { beforeEach, describe, expect, it } from "vitest";
import { useWishlist } from "./store";

describe("wishlist — ус ба багц (0107)", () => {
  beforeEach(() => useWishlist.setState({ ids: [], collectionIds: [] }));

  it("keeps bundles in their own list", () => {
    useWishlist.getState().toggle("p1");
    useWishlist.getState().toggleCollection("c1");
    expect(useWishlist.getState().ids).toEqual(["p1"]);
    expect(useWishlist.getState().collectionIds).toEqual(["c1"]);
    useWishlist.getState().toggleCollection("c1");
    expect(useWishlist.getState().collectionIds).toEqual([]);
  });

  it("clears both lists", () => {
    useWishlist.getState().toggle("p1");
    useWishlist.getState().toggleCollection("c1");
    useWishlist.getState().clear();
    expect(useWishlist.getState()).toMatchObject({
      ids: [],
      collectionIds: [],
    });
  });
});
