import { describe, expect, it } from "vitest";
import { giftAllowanceFor, giftProgress } from "./gift";

describe("giftAllowanceFor", () => {
  it("200,000₮ тутамд 1 эрх", () => {
    expect(giftAllowanceFor(0)).toBe(0);
    expect(giftAllowanceFor(199_999)).toBe(0);
    expect(giftAllowanceFor(200_000)).toBe(1);
    expect(giftAllowanceFor(399_999)).toBe(1);
    expect(giftAllowanceFor(400_000)).toBe(2);
    expect(giftAllowanceFor(650_000)).toBe(3);
  });

  it("багц тусдаа эрх өгөхгүй — зөвхөн дүн: preset 10мл багц 150K → 0", () => {
    expect(giftAllowanceFor(150_000)).toBe(0);
  });

  it("купоны дараах дүнгээр: 220K − 10% = 198K → 0", () => {
    expect(giftAllowanceFor(220_000 - 22_000)).toBe(0);
  });

  it("сөрөг утга гарахгүй", () => {
    expect(giftAllowanceFor(-5000)).toBe(0);
  });
});

describe("giftProgress", () => {
  it("хоосон сагс: бүтэн босго дутуу", () => {
    expect(giftProgress(0)).toEqual({ allowance: 0, toNext: 200_000 });
  });

  it("босгод 1₮ дутуу", () => {
    expect(giftProgress(199_999)).toEqual({ allowance: 0, toNext: 1 });
  });

  it("яг босго дээр: 1 эрх, дараагийнх хүртэл бүтэн босго", () => {
    expect(giftProgress(200_000)).toEqual({ allowance: 1, toNext: 200_000 });
  });

  it("350K: 1 эрх, дараагийнх хүртэл 50K", () => {
    expect(giftProgress(350_000)).toEqual({ allowance: 1, toNext: 50_000 });
  });

  it("сөрөг дүнг 0 гэж үзнэ", () => {
    expect(giftProgress(-10)).toEqual({ allowance: 0, toNext: 200_000 });
  });
});
