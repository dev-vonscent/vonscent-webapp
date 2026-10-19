import { describe, expect, it } from "vitest";
import { extraSaveSchema } from "@/lib/validators/extras";
import { emptyDraft, toSavePayload } from "./extra-draft";

describe("toSavePayload + extraSaveSchema", () => {
  it("хоосон үнийг 0 гэж чимээгүй хадгалахгүй", () => {
    const d = emptyDraft("local_quantity");
    d.name = "Хайрцаг";
    const parsed = extraSaveSchema.safeParse(toSavePayload(d));
    expect(parsed.success).toBe(false);
  });

  it("энгийн бараа: анхны тоо хоосон бол 0", () => {
    const d = emptyDraft("local_quantity");
    d.name = "Шприц";
    d.variants[0].price = "3,500";
    const out = toSavePayload(d);
    expect(out).toMatchObject({
      mode: "local_quantity",
      variants: [{ price: 3500, initialQty: 0 }],
    });
    expect(extraSaveSchema.safeParse(out).success).toBe(true);
  });

  it("олон хувилбарт нэр заавал, давхардахгүй", () => {
    const d = emptyDraft("local_quantity");
    d.name = "Хайрцаг";
    d.variants = [
      { ...d.variants[0], label: "Хар", price: "1000" },
      { ...d.variants[0], key: "b", label: " хар ", price: "1000" },
    ];
    const r = extraSaveSchema.safeParse(toSavePayload(d));
    expect(r.success).toBe(false);
  });

  it("нэг савыг хоёр удаа сонгохгүй", () => {
    const d = emptyDraft("shared_vial");
    d.name = "Ягаан сав";
    const vialId = "7f1d1c64-2b5b-4b5e-9f50-6d0b0c7a5a11";
    d.variants = [
      {
        key: "a",
        vialId,
        label: "",
        price: "2000",
        isActive: true,
        sort: 0,
        initialQty: "",
      },
      {
        key: "b",
        vialId,
        label: "",
        price: "2000",
        isActive: true,
        sort: 1,
        initialQty: "",
      },
    ];
    expect(extraSaveSchema.safeParse(toSavePayload(d)).success).toBe(false);
  });

  it("үлдэгдэлтэй шил: үлдсэн нь бүтнээс их байж болохгүй", () => {
    const d = emptyDraft("leftover_liquid");
    d.name = "Aventus шил";
    d.leftoverPrice = "25000";
    d.leftover = {
      productId: "7f1d1c64-2b5b-4b5e-9f50-6d0b0c7a5a11",
      productName: "Aventus",
      productBrand: "Creed",
      productImage: null,
      productAvailableMl: 50,
      remainingMl: "120",
      fullMl: "100",
    };
    expect(extraSaveSchema.safeParse(toSavePayload(d)).success).toBe(false);
    d.leftover.remainingMl = "18";
    expect(extraSaveSchema.safeParse(toSavePayload(d)).success).toBe(true);
  });
});
