import { describe, expect, it } from "vitest";
import { orderLineMeta, orderLineTitle, vialLabel } from "./order-lines";

describe("order-lines", () => {
  it("үнэртний мөр ml-ээр", () => {
    const line = { line_kind: "perfume" as const, ml: 10, qty: 2 };
    expect(orderLineMeta(line)).toBe("10ml × 2");
    expect(orderLineTitle({ ...line, product_name: "Aventus" })).toBe(
      "Aventus · 10ml",
    );
  });

  it("line_kind-гүй хуучин мөр үнэртэн гэж уншигдана", () => {
    expect(orderLineMeta({ ml: 5, qty: 1 })).toBe("5ml × 1");
  });

  it("нэмэлт барааны мөр хувилбараар", () => {
    const line = {
      line_kind: "extra" as const,
      ml: null,
      qty: 2,
      variant_label: "Хар",
    };
    expect(orderLineMeta(line)).toBe("Хар × 2");
    expect(orderLineTitle({ ...line, product_name: "Бэлгийн хайрцаг" })).toBe(
      "Бэлгийн хайрцаг — Хар",
    );
  });

  it("хувилбаргүй нэмэлт бараа", () => {
    const line = {
      line_kind: "extra" as const,
      ml: null,
      qty: 1,
      variant_label: "",
    };
    expect(orderLineMeta(line)).toBe("× 1");
    expect(orderLineTitle({ ...line, product_name: "Шприц" })).toBe("Шприц");
  });

  it("савны шошго", () => {
    expect(vialLabel({ style: "black", ml: 10 })).toBe("Хар сав");
    expect(vialLabel({ style: null, ml: 2 })).toBe("2ml сав");
  });
});
