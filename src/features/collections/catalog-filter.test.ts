import { describe, it, expect } from "vitest";
import {
  catalogPrice,
  filterCatalogCollections,
  sortCatalogCollections,
} from "./catalog-filter";
import type { Collection, CollectionMember } from "./types";

const m = (over: Partial<CollectionMember> = {}) =>
  ({
    name: "Sauvage",
    brand: "Dior",
    scentFamilies: ["fresh"],
    seasons: ["summer"],
    ...over,
  }) as CollectionMember;

const c = (over: Partial<Collection> = {}) =>
  ({
    id: "c1",
    name: "GENTLEMAN",
    gender: "male",
    tags: [],
    isFeatured: false,
    soldOut: false,
    availableMls: [2, 5],
    startingPrice: 100_000,
    createdAt: "2026-10-01",
    members: [m(), m({ brand: "Creed", scentFamilies: ["woody"] })],
    ...over,
  }) as Collection;

const ids = (cs: Collection[]) => cs.map((x) => x.id);

describe("filterCatalogCollections", () => {
  it("шүүлтүүргүй бол дууссан нь ч бүх багц", () => {
    expect(
      ids(filterCatalogCollections([c(), c({ id: "c2", soldOut: true })], {})),
    ).toEqual(["c1", "c2"]);
  });

  it("дууссан багцыг хамгийн бага хэмжээний үнээр шүүнэ", () => {
    const out = c({
      soldOut: true,
      startingPrice: 0,
      prices: [{ price: 120_000 }, { price: 90_000 }] as Collection["prices"],
    });
    expect(catalogPrice(out)).toBe(90_000);
    expect(filterCatalogCollections([out], { maxPrice: 50_000 })).toHaveLength(
      0,
    );
    expect(filterCatalogCollections([out], { maxPrice: 95_000 })).toHaveLength(
      1,
    );
  });

  it("брэнд, үнэрийн төрөл — аль нэг гишүүнээр", () => {
    expect(filterCatalogCollections([c()], { brand: ["Creed"] })).toHaveLength(
      1,
    );
    expect(filterCatalogCollections([c()], { brand: ["Chanel"] })).toHaveLength(
      0,
    );
    expect(filterCatalogCollections([c()], { family: ["woody"] })).toHaveLength(
      1,
    );
    expect(
      filterCatalogCollections([c()], { family: ["floral"] }),
    ).toHaveLength(0);
  });

  it("улирал — «all» гишүүн бүх улиралд таарна", () => {
    expect(
      filterCatalogCollections([c()], { season: ["winter"] }),
    ).toHaveLength(0);
    const yearRound = c({ members: [m({ seasons: ["all"] })] });
    expect(
      filterCatalogCollections([yearRound], { season: ["winter"] }),
    ).toHaveLength(1);
  });

  it("хүйс, үнэ, хэмжээ", () => {
    expect(
      filterCatalogCollections([c()], { gender: ["female"] }),
    ).toHaveLength(0);
    expect(filterCatalogCollections([c()], { maxPrice: 90_000 })).toHaveLength(
      0,
    );
    expect(filterCatalogCollections([c()], { minPrice: 90_000 })).toHaveLength(
      1,
    );
    expect(filterCatalogCollections([c()], { ml: [20] })).toHaveLength(0);
    expect(filterCatalogCollections([c()], { ml: [5] })).toHaveLength(1);
  });

  it("таг: «Хямдрал» багцад хамаарахгүй", () => {
    const hot = c({ tags: ["hot"] });
    expect(filterCatalogCollections([hot], { tags: ["hot"] })).toHaveLength(1);
    expect(filterCatalogCollections([hot], { tags: ["new"] })).toHaveLength(0);
    expect(filterCatalogCollections([hot], { tags: ["sale"] })).toHaveLength(0);
    expect(
      filterCatalogCollections([hot], { tags: ["sale", "hot"] }),
    ).toHaveLength(1);
  });

  it("онцлох, хайлт (багцын болон гишүүний нэр)", () => {
    expect(filterCatalogCollections([c()], { featured: true })).toHaveLength(0);
    expect(filterCatalogCollections([c()], { search: "gentle" })).toHaveLength(
      1,
    );
    expect(filterCatalogCollections([c()], { search: "диор" })).toHaveLength(1);
    expect(
      filterCatalogCollections([c()], { search: "baccarat" }),
    ).toHaveLength(0);
  });
});

describe("sortCatalogCollections", () => {
  it("үнээр", () => {
    const cs = [
      c({ id: "a", startingPrice: 3 }),
      c({ id: "b", startingPrice: 1 }),
    ];
    expect(ids(sortCatalogCollections(cs, "price_asc"))).toEqual(["b", "a"]);
    expect(ids(sortCatalogCollections(cs, "price_desc"))).toEqual(["a", "b"]);
  });

  it("үнээс бусад эрэмбэд дууссан нь ард", () => {
    const cs = [
      c({ id: "old-out", soldOut: true, createdAt: "2026-10-05" }),
      c({ id: "live", createdAt: "2026-09-01" }),
    ];
    expect(ids(sortCatalogCollections(cs, "new"))).toEqual(["live", "old-out"]);
    expect(ids(sortCatalogCollections(cs, "recommended"))).toEqual([
      "live",
      "old-out",
    ]);
  });
});
