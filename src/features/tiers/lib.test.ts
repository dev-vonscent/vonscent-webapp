import { describe, expect, it } from "vitest";
import {
  lifetimeSpendOf,
  displayName,
  periodRange,
  pointsAtTierRate,
  tierForSpend,
  tierProgress,
} from "./lib";

describe("tierForSpend", () => {
  it("босго нь доод хязгаартаа багтана (SQL-ийн `>=`)", () => {
    expect(tierForSpend(0).key).toBe("standard");
    expect(tierForSpend(999_999).key).toBe("standard");
    expect(tierForSpend(1_000_000).key).toBe("gold");
    expect(tierForSpend(3_000_000).key).toBe("platinum");
    expect(tierForSpend(5_000_000).key).toBe("sapphire");
    expect(tierForSpend(9_999_999).key).toBe("sapphire");
    expect(tierForSpend(10_000_000).key).toBe("ruby");
    expect(tierForSpend(80_000_000).rate).toBe(5);
  });
});

describe("tierProgress", () => {
  it("түвшний доторх явц ба үлдэгдэл", () => {
    const p = tierProgress(2_000_000);
    expect(p.tier.key).toBe("gold");
    expect(p.next?.key).toBe("platinum");
    expect(p.remaining).toBe(1_000_000);
    expect(p.ratio).toBeCloseTo(0.5);
  });

  it("дээд түвшинд дараагийнх байхгүй", () => {
    expect(tierProgress(12_000_000)).toMatchObject({
      next: null,
      remaining: 0,
      ratio: 1,
    });
  });
});

describe("pointsAtTierRate", () => {
  it("floor(суурь × хувь / 100)", () => {
    expect(pointsAtTierRate(45_990, 1)).toBe(459);
    expect(pointsAtTierRate(45_990, 3)).toBe(1379);
    expect(pointsAtTierRate(-5, 5)).toBe(0);
  });
});

describe("lifetimeSpendOf", () => {
  it("төлөгдсөн, цуцлагдаагүй захиалгын купоны дараах дүн", () => {
    expect(
      lifetimeSpendOf([
        {
          payment_status: "paid",
          status: "delivered",
          subtotal: 100_000,
          discount: 10_000,
        },
        {
          payment_status: "paid",
          status: "cancelled",
          subtotal: 50_000,
          discount: 0,
        },
        {
          payment_status: "unpaid",
          status: "pending",
          subtotal: 70_000,
          discount: 0,
        },
        {
          payment_status: "refunded",
          status: "cancelled",
          subtotal: 30_000,
          discount: 0,
        },
        {
          payment_status: "paid",
          status: "confirmed",
          subtotal: 20_000,
          discount: null,
        },
      ]),
    ).toBe(110_000);
  });
});

describe("displayName", () => {
  it("бүтэн нэр, хоосон бол ерөнхий нэр", () => {
    expect(displayName("  Болормаа Бат ")).toBe("Болормаа Бат");
    expect(displayName("  ")).toBe("vonscent гишүүн");
    expect(displayName(null)).toBe("vonscent гишүүн");
  });
});

describe("periodRange", () => {
  const now = new Date("2026-10-18T02:00:00Z");

  it("сүүлийн 7 хоног, 1 сар — одоогоос ухарна", () => {
    expect(periodRange("week", now).from.toISOString()).toBe(
      "2026-10-11T02:00:00.000Z",
    );
    expect(periodRange("month", now).from.toISOString()).toBe(
      "2026-09-18T02:00:00.000Z",
    );
    expect(periodRange("week", now).to).toEqual(now);
  });

  it("бүх цаг үе нь эхнээс", () => {
    expect(periodRange("all", now).from.getTime()).toBe(0);
  });
});
