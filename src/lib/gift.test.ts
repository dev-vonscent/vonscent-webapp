import { describe, expect, it } from "vitest";
import {
  giftAllowanceFor,
  giftCapacity,
  giftProgress,
  giftSlotsFor,
  limitGiftPicks,
} from "./gift";

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

  it("дээд тагтай: 1М₮ → 5, түүнээс дээш дүн эрх нэмэхгүй", () => {
    expect(giftAllowanceFor(1_000_000)).toBe(5);
    expect(giftAllowanceFor(3_000_000)).toBe(5);
  });
});

describe("giftSlotsFor", () => {
  it("сан хүрэлцэхэд эрх бүтнээрээ", () => {
    expect(giftSlotsFor(600_000, 4)).toEqual({
      earned: 3,
      allowance: 3,
      cappedByPool: false,
    });
  });

  it("4 ус × 2 = 8 багтаамж — 5 эрх бүтнээрээ багтана", () => {
    expect(giftCapacity(4)).toBe(8);
    expect(giftSlotsFor(1_000_000, 4)).toEqual({
      earned: 5,
      allowance: 5,
      cappedByPool: false,
    });
  });

  it("2 ус × 2 = 4 багтаамж — 5 эрх 4 болж хумигдана", () => {
    expect(giftSlotsFor(1_000_000, 2)).toEqual({
      earned: 5,
      allowance: 4,
      cappedByPool: true,
    });
  });

  it("сан хоосон бол эрх 0", () => {
    expect(giftSlotsFor(1_000_000, 0).allowance).toBe(0);
  });
});

describe("limitGiftPicks", () => {
  it("нэг уснаас хамгийн ихдээ 2 — илүүг нь хаяна", () => {
    expect([...limitGiftPicks(["a", "a", "a"], 5)]).toEqual([["a", 2]]);
  });

  it("нийт эрхээс хэтэрсэн сонголт орохгүй", () => {
    expect([...limitGiftPicks(["a", "b", "c"], 2)]).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("зөвшөөрөгдөөгүй ус алгасагдана, эрх нь дараагийнх руу шилжинэ", () => {
    const out = limitGiftPicks(["x", "a", "b"], 2, (id) => id !== "x");
    expect([...out]).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("аль хэдийн авсан тоог `isAllowed`-д дамжуулна (үлдэгдэл шалгах)", () => {
    // Зөвхөн 1 ширхэг л үлдэгдэлтэй ус: хоёр дахийг нь татгалзана.
    const out = limitGiftPicks(["a", "a"], 5, (_id, taken) => taken < 1);
    expect([...out]).toEqual([["a", 1]]);
  });
});

describe("giftProgress", () => {
  it("хоосон сагс: бүтэн босго дутуу", () => {
    expect(giftProgress(0)).toEqual({
      allowance: 0,
      toNext: 200_000,
      atMax: false,
    });
  });

  it("босгод 1₮ дутуу", () => {
    expect(giftProgress(199_999)).toEqual({
      allowance: 0,
      toNext: 1,
      atMax: false,
    });
  });

  it("яг босго дээр: 1 эрх, дараагийнх хүртэл бүтэн босго", () => {
    expect(giftProgress(200_000)).toEqual({
      allowance: 1,
      toNext: 200_000,
      atMax: false,
    });
  });

  it("350K: 1 эрх, дараагийнх хүртэл 50K", () => {
    expect(giftProgress(350_000)).toEqual({
      allowance: 1,
      toNext: 50_000,
      atMax: false,
    });
  });

  it("сөрөг дүнг 0 гэж үзнэ", () => {
    expect(giftProgress(-10)).toEqual({
      allowance: 0,
      toNext: 200_000,
      atMax: false,
    });
  });

  it("тагт хүрсэн үед дараагийн эрх амлахгүй", () => {
    expect(giftProgress(1_200_000)).toEqual({
      allowance: 5,
      toNext: 0,
      atMax: true,
    });
  });
});
