import { describe, expect, it } from "vitest";
import { expandGenders } from "./api";

describe("expandGenders", () => {
  it("adds unisex to a male or female filter", () => {
    // «Эрэгтэй» means "a scent a man would wear", and a unisex bottle is one.
    expect(expandGenders(["male"])).toEqual(["male", "unisex"]);
    expect(expandGenders(["female"])).toEqual(["female", "unisex"]);
    expect(expandGenders(["male", "female"])).toEqual([
      "male",
      "female",
      "unisex",
    ]);
  });

  it("leaves unisex on its own alone — that is a narrower question", () => {
    expect(expandGenders(["unisex"])).toEqual(["unisex"]);
  });

  it("does not duplicate unisex when it is already picked", () => {
    expect(expandGenders(["male", "unisex"])).toEqual(["male", "unisex"]);
  });

  it("passes an absent filter straight through", () => {
    expect(expandGenders(undefined)).toBeUndefined();
    expect(expandGenders([])).toEqual([]);
  });
});
