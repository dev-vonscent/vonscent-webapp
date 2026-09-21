import { describe, expect, it } from "vitest";
import { matchesGender } from "./collection-browser";

describe("matchesGender", () => {
  it("«Эрэгтэй»/«Эмэгтэй» сонголтод unisex багц ч харагдана", () => {
    expect(matchesGender("male", "male")).toBe(true);
    expect(matchesGender("unisex", "male")).toBe(true);
    expect(matchesGender("unisex", "female")).toBe(true);
    expect(matchesGender("female", "male")).toBe(false);
  });

  it("«Unisex» дангаараа зөвхөн unisex-ийг харуулна", () => {
    expect(matchesGender("unisex", "unisex")).toBe(true);
    expect(matchesGender("male", "unisex")).toBe(false);
    expect(matchesGender("female", "unisex")).toBe(false);
  });

  it("«Бүгд» бүгдийг нэвтрүүлнэ", () => {
    expect(matchesGender("male", "all")).toBe(true);
    expect(matchesGender("unisex", "all")).toBe(true);
  });
});
