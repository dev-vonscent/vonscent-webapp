import { describe, expect, it } from "vitest";
import {
  extraPurchaseSchema,
  purchaseDateBounds,
  purchaseDateError,
  vialPurchaseSchema,
} from "./extras";
import { ubToday } from "@/lib/time";

const id = "7f1d1c64-2b5b-4b5e-9f50-6d0b0c7a5a11";

describe("purchaseDateError — 0153 purchase_date_check-тэй ижил", () => {
  const today = "2026-10-20";
  it("энэ сарын өнгөрсөн өдөр ба өнөөдөр зөвшөөрнө", () => {
    expect(purchaseDateError("2026-10-01", today)).toBeNull();
    expect(purchaseDateError("2026-10-20", today)).toBeNull();
  });
  it("ирээдүй, өмнөх сар хориотой", () => {
    expect(purchaseDateError("2026-10-21", today)).toMatch(/ирээдүй/);
    expect(purchaseDateError("2026-09-30", today)).toMatch(/хаагдсан/);
  });
  it("календарийн хүрээ = энэ сарын 1 — өнөөдөр", () => {
    expect(purchaseDateBounds(today)).toEqual({
      min: "2026-10-01",
      max: "2026-10-20",
    });
  });
});

describe("нөөц нөхөх схем", () => {
  const base = {
    qty: 100,
    unitCost: 450,
    purchasedOn: ubToday(),
    expectedUpdatedAt: null,
  };
  it("энгийн бараа ба сав", () => {
    expect(
      extraPurchaseSchema.safeParse({ variantId: id, ...base }).success,
    ).toBe(true);
    expect(vialPurchaseSchema.safeParse({ vialId: id, ...base }).success).toBe(
      true,
    );
  });
  it("0 ширхэг, сөрөг үнэ, хоосон өдөр татгалзана", () => {
    for (const bad of [
      { qty: 0 },
      { unitCost: -1 },
      { purchasedOn: "" },
      { purchasedOn: "2000-01-01" },
    ]) {
      expect(
        extraPurchaseSchema.safeParse({ variantId: id, ...base, ...bad })
          .success,
      ).toBe(false);
    }
  });
  it("үнэгүй (0₮) худалдан авалтыг зөвшөөрнө", () => {
    expect(
      extraPurchaseSchema.safeParse({ variantId: id, ...base, unitCost: 0 })
        .success,
    ).toBe(true);
  });
});
