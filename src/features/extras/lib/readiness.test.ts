import { describe, expect, it } from "vitest";
import { emptyDraft } from "../components/admin/extra-draft";
import { draftMissing } from "./readiness";

const vial = {
  id: "v10",
  style: "pink" as const,
  ml: 10,
  onHand: 40,
  reserved: 1,
  available: 39,
  lowThreshold: 10,
  isActive: true,
  note: "",
  updatedAt: "",
};

describe("draftMissing", () => {
  it("энгийн бараа: үнэгүй хувилбар", () => {
    const d = emptyDraft("local_quantity");
    d.name = "Хайрцаг";
    expect(draftMissing(d, [])).toEqual(["Үнэ оруулаагүй хувилбар байна"]);
    d.variants[0].price = "15000";
    expect(draftMissing(d, [])).toEqual([]);
  });

  it("грамын сав: тоо оруулаагүй сав", () => {
    const d = emptyDraft("shared_vial");
    d.name = "Сав";
    expect(draftMissing(d, [vial])).toContain("Ядаж нэг сав сонгоно уу");
    d.variants = [
      {
        key: "a",
        vialId: "v10",
        label: "",
        price: "2000",
        isActive: true,
        sort: 0,
        batchCode: "",
        sizeNote: "",
        imageUrl: "",
      },
    ];
    expect(draftMissing(d, [vial])).toEqual([]);
    expect(draftMissing(d, [{ ...vial, onHand: null }])).toEqual([
      "Тоо оруулаагүй сав сонгогдсон байна",
    ]);
  });

  it("үлдэгдэлтэй шил", () => {
    const d = emptyDraft("leftover_liquid");
    d.name = "Шил";
    expect(draftMissing(d, [])).toContain(
      "Аль үнэртний шил болохыг сонгоно уу",
    );
  });
});
