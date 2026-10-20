import { describe, expect, it } from "vitest";
import { extraSaveSchema } from "@/lib/validators/extras";
import type { AdminExtra } from "../../types";
import { emptyDraft, relistDraft, toSavePayload } from "./extra-draft";

describe("toSavePayload + extraSaveSchema", () => {
  it("хоосон үнийг 0 гэж чимээгүй хадгалахгүй", () => {
    const d = emptyDraft("local_quantity");
    d.name = "Хайрцаг";
    const parsed = extraSaveSchema.safeParse(toSavePayload(d));
    expect(parsed.success).toBe(false);
  });

  it("энгийн бараа: тоо маягтаар орохгүй (нөөц нөхөх — 0153)", () => {
    const d = emptyDraft("local_quantity");
    d.name = "Шприц";
    d.variants[0].price = "3,500";
    const out = toSavePayload(d);
    expect(out).toMatchObject({
      mode: "local_quantity",
      variants: [{ price: 3500 }],
    });
    expect(out.mode === "local_quantity" && out.variants[0]).not.toHaveProperty(
      "initialQty",
    );
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
        batchCode: "",
        sizeNote: "",
        imageUrl: "",
      },
      {
        key: "b",
        vialId,
        label: "",
        price: "2000",
        isActive: true,
        sort: 1,
        batchCode: "",
        sizeNote: "",
        imageUrl: "",
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

  it("batch code ба хэмжээ payload-д орно, бүтэн хэмжээ attrs-д", () => {
    const d = emptyDraft("local_quantity");
    d.name = "JPG Le Male Elixir";
    d.bottleMl = "125";
    d.variants[0] = {
      ...d.variants[0]!,
      label: "A1234",
      batchCode: "A1234",
      price: "15000",
    };
    const out = toSavePayload(d);
    expect(out).toMatchObject({
      bottleMl: 125,
      variants: [{ label: "A1234", batchCode: "A1234", price: 15000 }],
    });
    expect(extraSaveSchema.safeParse(out).success).toBe(true);
  });
});

describe("relistDraft — зарагдсан шилийг дахин нийтлэх", () => {
  it("мэдээллийг хуулж, ml, үнэ, хувилбарыг хоослоно", () => {
    const sold = {
      id: "e1",
      mode: "leftover_liquid",
      name: "Creed Aventus",
      description: "Хайрцаггүй",
      images: ["https://x/1.jpg"],
      sort: 0,
      capacity: null,
      bottleMl: null,
      variants: [{ id: "v1", price: 25000 }],
      leftover: {
        productId: "p1",
        productName: "Aventus",
        productBrand: "Creed",
        productImage: null,
        productAvailableMl: 40,
        remainingMl: 18,
        fullMl: 100,
        lockState: "committed",
        lockedMl: 18,
      },
    } as unknown as AdminExtra;
    const d = relistDraft(sold);
    expect(d).toMatchObject({
      mode: "leftover_liquid",
      name: "Creed Aventus",
      images: ["https://x/1.jpg"],
      leftoverPrice: "",
      leftover: { productId: "p1", fullMl: "100", remainingMl: "" },
    });
    expect(d.leftoverVariantId).toBeUndefined();
  });
});
