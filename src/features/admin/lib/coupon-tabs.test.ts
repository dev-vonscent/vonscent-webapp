import { describe, expect, it } from "vitest";
import {
  filterCoupons,
  parseCouponStatus,
  parseCouponTab,
  type CouponFilterQuery,
} from "./coupon-tabs";

/** Records every filter call so the PostgREST shape can be asserted. */
function recorder() {
  const calls: unknown[][] = [];
  const q: CouponFilterQuery = {
    is: (...a) => (calls.push(["is", ...a]), q),
    not: (...a) => (calls.push(["not", ...a]), q),
    eq: (...a) => (calls.push(["eq", ...a]), q),
    neq: (...a) => (calls.push(["neq", ...a]), q),
    or: (...a) => (calls.push(["or", ...a]), q),
  };
  return { q, calls };
}

const NOW = "2026-10-09T00:00:00.000Z";

describe("filterCoupons — табууд", () => {
  const tab = (t: Parameters<typeof filterCoupons>[1]) => {
    const r = recorder();
    filterCoupons(r.q, t, "all", NOW);
    return r.calls;
  };

  it("Код = эзэмшигчгүй", () => {
    expect(tab("code")).toEqual([["is", "user_id", null]]);
  });

  it("Хувийн = эзэмшигчтэй, захиалгын ба хүрдний биш", () => {
    expect(tab("personal")).toEqual([
      ["not", "user_id", "is", null],
      ["is", "source_order_id", null],
      ["neq", "source", "spin"],
    ]);
  });

  it("Автомат = захиалгаас үүссэн", () => {
    expect(tab("auto")).toEqual([["not", "source_order_id", "is", null]]);
  });

  it("Азын хүрд = source spin", () => {
    expect(tab("spin")).toEqual([
      ["is", "source_order_id", null],
      ["eq", "source", "spin"],
    ]);
  });
});

describe("filterCoupons — төлөв", () => {
  const status = (s: Parameters<typeof filterCoupons>[2]) => {
    const r = recorder();
    filterCoupons(r.q, "code", s, NOW);
    return r.calls.slice(1);
  };

  it("Идэвхтэй: дуусаагүй, асаалттай, хугацаа өнгөрөөгүй", () => {
    expect(status("active")).toEqual([
      ["eq", "used_up", false],
      ["eq", "is_active", true],
      ["or", `ends_at.is.null,ends_at.gt."${NOW}"`],
    ]);
  });

  it("Ашигласан нь давамгайлна", () => {
    expect(status("used")).toEqual([["eq", "used_up", true]]);
  });

  it("Дууссан: унтраасан эсвэл хугацаа өнгөрсөн, гэхдээ ашиглаагүй", () => {
    expect(status("expired")).toEqual([
      ["eq", "used_up", false],
      ["or", `is_active.eq.false,ends_at.lte."${NOW}"`],
    ]);
  });

  it("Бүгд: нэмэлт нөхцөлгүй", () => {
    expect(status("all")).toEqual([]);
  });
});

describe("parse", () => {
  it("буруу утга анхдагч руу", () => {
    expect(parseCouponTab("x")).toBe("code");
    expect(parseCouponTab("auto")).toBe("auto");
    expect(parseCouponStatus(undefined)).toBe("active");
    expect(parseCouponStatus("used")).toBe("used");
  });
});
