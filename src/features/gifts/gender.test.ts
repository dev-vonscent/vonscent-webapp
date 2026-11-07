import { describe, expect, it } from "vitest";
import type { Gender } from "@/lib/constants";
import { genderNoun, groupByGender, leadGender } from "./gender";

const G: Record<string, Gender> = { a: "male", b: "female", c: "unisex" };

describe("leadGender", () => {
  it("weighs by ml, ignoring unisex", () => {
    expect(
      leadGender(
        [
          { productId: "a", ml: 5 },
          { productId: "b", ml: 10 },
          { productId: "c", ml: 40 },
        ],
        (id) => G[id],
      ),
    ).toBe("female");
  });

  it("is null on a tie or with nothing known", () => {
    expect(
      leadGender(
        [
          { productId: "a", ml: 5 },
          { productId: "b", ml: 5 },
        ],
        (id) => G[id],
      ),
    ).toBeNull();
    expect(leadGender([{ productId: "x", ml: 5 }], () => undefined)).toBeNull();
  });
});

describe("groupByGender", () => {
  const items = [
    { id: "1", gender: "male" as const },
    { id: "2", gender: "female" as const },
    { id: "3" },
    { id: "4", gender: "male" as const },
  ];

  it("puts the lead first, unisex in the middle, drops empty groups", () => {
    const groups = groupByGender(items, "male");
    expect(groups.map((g) => g.gender)).toEqual(["male", "female", null]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["1", "4"]);
    expect(groups[2].label).toBeNull();
  });
});

describe("genderNoun", () => {
  it("reads as a noun phrase", () => {
    expect(genderNoun("female")).toBe("эмэгтэй ус");
    expect(genderNoun("unisex")).toBe("unisex ус");
    expect(genderNoun(undefined)).toBeNull();
  });
});
