import { describe, expect, it } from "vitest";
import {
  bundleGiftGuarantee,
  giftAllowanceFor,
  giftGuaranteeFor,
} from "./gift";

const preset = (ml: number, qty = 1) => ({ type: "base" as const, ml, qty });
const custom = (ml: number, qty = 1) => ({ type: "custom" as const, ml, qty });

// backlog.md §0 «Бэлгийн эцсийн дүрэм» жишээнүүд шууд кейс болсон.
describe("bundleGiftGuarantee", () => {
  it("preset 5/10/20мл багц хувь тутамд 1 эрх өгнө", () => {
    expect(bundleGiftGuarantee(preset(5))).toBe(1);
    expect(bundleGiftGuarantee(preset(10))).toBe(1);
    expect(bundleGiftGuarantee(preset(20, 3))).toBe(3);
  });

  it("preset 2мл багц эрх өгөхгүй", () => {
    expect(bundleGiftGuarantee(preset(2, 5))).toBe(0);
  });

  it("custom багц ямар ч хэмжээгээр эрх өгөхгүй", () => {
    expect(bundleGiftGuarantee(custom(20, 2))).toBe(0);
  });

  it("багцуудын баталгаа нэмэгдэнэ", () => {
    expect(giftGuaranteeFor([preset(10), preset(20, 2), custom(10)])).toBe(3);
  });
});

describe("giftAllowanceFor", () => {
  it("дан бараа: 190K → 0, 210K → 1, 400K → 2", () => {
    expect(giftAllowanceFor(190_000, 0)).toBe(0);
    expect(giftAllowanceFor(210_000, 0)).toBe(1);
    expect(giftAllowanceFor(400_000, 0)).toBe(2);
  });

  it("custom багц 150K → 0, 420K → 2 (зөвхөн дүнгээр)", () => {
    expect(giftAllowanceFor(150_000, giftGuaranteeFor([custom(10)]))).toBe(0);
    expect(giftAllowanceFor(420_000, giftGuaranteeFor([custom(10)]))).toBe(2);
  });

  it("preset 2мл багц 150K → 0", () => {
    expect(giftAllowanceFor(150_000, giftGuaranteeFor([preset(2)]))).toBe(0);
  });

  it("preset 10мл багц 150K → 1, 450K → 2 (ихийг нь авна)", () => {
    expect(giftAllowanceFor(150_000, giftGuaranteeFor([preset(10)]))).toBe(1);
    expect(giftAllowanceFor(450_000, giftGuaranteeFor([preset(10)]))).toBe(2);
  });

  it("хоёр preset багц 380K → 2 (баталгаа ялна)", () => {
    expect(
      giftAllowanceFor(380_000, giftGuaranteeFor([preset(10), preset(20)])),
    ).toBe(2);
  });

  it("хүргэлт ороогүй дүнгээр — 197K хэвээрээ 0", () => {
    expect(giftAllowanceFor(197_000, 0)).toBe(0);
  });

  it("сөрөг утга гарахгүй", () => {
    expect(giftAllowanceFor(-5000, 0)).toBe(0);
    expect(giftAllowanceFor(100_000, -2)).toBe(0);
  });
});
