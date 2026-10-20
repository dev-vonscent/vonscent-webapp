import { describe, expect, it } from "vitest";
import type { AdminExtra, AdminExtraVariant } from "../types";
import { adminToShopCard, extraStockLabel } from "./stock";

function variant(over: Partial<AdminExtraVariant> = {}): AdminExtraVariant {
  return {
    id: "v1",
    label: "Хар",
    price: 15000,
    onHand: 10,
    reserved: 0,
    available: 10,
    vialId: null,
    isActive: true,
    sort: 0,
    updatedAt: "2026-10-19T00:00:00Z",
    batchCode: null,
    sizeNote: null,
    imageUrl: null,
    ...over,
  };
}

function extra(over: Partial<AdminExtra> = {}): AdminExtra {
  return {
    id: "e1",
    categoryId: "c1",
    categoryName: "Бэлгийн хайрцаг",
    categorySlug: "gift-box",
    mode: "local_quantity",
    slug: "box",
    name: "Хайрцаг",
    description: "",
    images: [],
    status: "published",
    bottleMl: null,
    sort: 0,
    variants: [variant()],
    leftover: null,
    fromPrice: 15000,
    readiness: [],
    updatedAt: "2026-10-19T00:00:00Z",
    ...over,
  };
}

describe("extraStockLabel", () => {
  it("нийт тоо", () => {
    expect(extraStockLabel(extra())).toEqual({
      label: "10 ширхэг",
      tone: "ok",
    });
  });
  it("цөөхөн нь хамгийн бага хувилбараар", () => {
    const e = extra({
      variants: [
        variant(),
        variant({ id: "v2", label: "Цагаан", available: 2 }),
      ],
    });
    expect(extraStockLabel(e)).toEqual({
      label: "Цөөхөн үлдсэн: 2 ширхэг",
      tone: "low",
    });
  });
  it("бүгд дууссан", () => {
    const e = extra({ variants: [variant({ available: 0 })] });
    expect(extraStockLabel(e).label).toBe("Дууссан");
  });
  it("идэвхгүй хувилбар тоологдохгүй", () => {
    const e = extra({ variants: [variant({ isActive: false })] });
    expect(extraStockLabel(e).label).toBe("Хувилбаргүй");
  });
  it("тоо оруулаагүй сав", () => {
    const e = extra({
      mode: "shared_vial",
      variants: [variant({ available: null, onHand: null })],
    });
    expect(extraStockLabel(e).label).toBe("Тоо оруулаагүй");
  });
  it("үлдэгдэлтэй шилний төлөв", () => {
    const leftover = {
      productId: "p",
      productName: "Aventus",
      productBrand: "Creed",
      productImage: null,
      productAvailableMl: 50,
      remainingMl: 18,
      fullMl: 100,
      lockState: "reserved" as const,
      lockedMl: 18,
    };
    expect(
      extraStockLabel(extra({ mode: "leftover_liquid", leftover })).label,
    ).toBe("Захиалгад орсон");
  });
});

describe("adminToShopCard", () => {
  it("зарагдах хувилбарын хамгийн бага үнэ", () => {
    const e = extra({
      variants: [
        variant({ price: 20000 }),
        variant({ id: "v2", price: 9000, available: 0 }),
      ],
    });
    const card = adminToShopCard(e);
    expect(card.fromPrice).toBe(20000);
    expect(card.soldOut).toBe(false);
  });
  it("бүгд дууссан бол бүх идэвхтэйнх, soldOut", () => {
    const e = extra({ variants: [variant({ price: 9000, available: 0 })] });
    const card = adminToShopCard(e);
    expect(card).toMatchObject({ fromPrice: 9000, soldOut: true });
  });
});
