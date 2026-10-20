import { describe, expect, it } from "vitest";
import { placeOrderError, toPlacedSummary } from "./place-order-result";

describe("placeOrderError", () => {
  it("ITEMS_UNAVAILABLE variant-тай / variant-гүй", () => {
    expect(placeOrderError("ITEMS_UNAVAILABLE:v1")?.body).toEqual({
      error: "ITEMS_UNAVAILABLE",
      variantIds: ["v1"],
    });
    expect(placeOrderError("ITEMS_UNAVAILABLE:")?.body).toEqual({
      error: "ITEMS_UNAVAILABLE",
      variantIds: [],
    });
  });

  it("дүн өөрчлөгдсөн — серверийн шинэ дүнтэй", () => {
    const r = placeOrderError(
      'TOTAL_CHANGED:{"total": 19000, "discount": 0, "subtotal": 14000, "loyalty_used": 0, "shipping_fee": 5000}',
    );
    expect(r).toEqual({
      status: 409,
      body: {
        error: "TOTAL_CHANGED",
        totals: {
          subtotal: 14000,
          discount: 0,
          loyaltyUsed: 0,
          shippingFee: 5000,
          total: 19000,
        },
      },
    });
    expect(
      placeOrderError('COUPON_CHANGED:{"total": 1, "discount": 0}')?.body.error,
    ).toBe("COUPON_CHANGED");
  });

  it("LOYALTY_CHANGED тоо", () => {
    expect(placeOrderError("LOYALTY_CHANGED:1200")?.body).toEqual({
      error: "LOYALTY_CHANGED",
      available: 1200,
    });
  });

  it("нэмэлт барааны алдаанууд", () => {
    expect(
      placeOrderError(
        'EXTRA_PRICE_CHANGED:{"prices": [{"unit_price": 15000, "extra_variant_id": "x"}]}',
      )?.body,
    ).toEqual({ error: "EXTRA_PRICE_CHANGED", prices: { x: 15000 } });
    expect(
      placeOrderError(
        'EXTRA_QTY_UNAVAILABLE:{"available": 1, "requested": 3, "extra_variant_id": "x"}',
      )?.body,
    ).toEqual({
      error: "EXTRA_QTY_UNAVAILABLE",
      extraVariantId: "x",
      available: 1,
      requested: 3,
    });
    expect(
      placeOrderError('LEFTOVER_ALREADY_SOLD:{"extra_variant_id": "x"}')?.body,
    ).toEqual({ error: "LEFTOVER_ALREADY_SOLD", extraVariantId: "x" });
    expect(
      placeOrderError(
        'VIAL_UNAVAILABLE:{"ml": 10, "style": "pink", "product_id": "p", "extra_variant_id": null}',
      )?.body,
    ).toEqual({
      error: "VIAL_UNAVAILABLE",
      productId: "p",
      extraVariantId: null,
      ml: 10,
    });
  });

  it("хуучин кодууд хэвээр", () => {
    expect(placeOrderError("INSUFFICIENT_STOCK:p1")?.body).toEqual({
      error: "OUT_OF_STOCK",
      productId: "p1",
    });
    expect(placeOrderError("BOTTLE_UNAVAILABLE:male:10")?.body.error).toBe(
      "BOTTLE_UNAVAILABLE",
    );
    expect(placeOrderError("ORDER_TOO_LARGE")?.status).toBe(400);
    expect(placeOrderError("connection reset")).toBeNull();
  });
});

describe("toPlacedSummary", () => {
  it("snake → camel", () => {
    const s = toPlacedSummary({
      order_id: "o",
      order_no: "VS-1",
      subtotal: 10,
      discount: 0,
      loyalty_used: 0,
      shipping_fee: 5,
      total: 15,
      omitted_gifts: [{ product_id: "g", reason: "threshold" }],
      lines: [
        {
          id: "i",
          line_kind: "extra",
          product_id: null,
          variant_id: null,
          extra_variant_id: "x",
          name: "Хайрцаг",
          brand: "Бэлгийн хайрцаг",
          variant_label: "Хар",
          ml: null,
          qty: 1,
          unit_price: 10,
          list_price: 10,
          line_total: 10,
          is_gift: false,
          collection_name: null,
        },
      ],
    });
    expect(s).toMatchObject({
      orderNo: "VS-1",
      shippingFee: 5,
      omittedGifts: [{ product_id: "g", reason: "threshold" }],
      lines: [{ kind: "extra", variantLabel: "Хар", lineTotal: 10 }],
    });
  });
});

describe("placeOrderError — хэрэглэсэн барааны зөвшөөрөл (0155)", () => {
  it("USED_GOODS_CONSENT_REQUIRED → 409", () => {
    expect(placeOrderError("USED_GOODS_CONSENT_REQUIRED")).toEqual({
      status: 409,
      body: { error: "USED_GOODS_CONSENT_REQUIRED" },
    });
  });
});
