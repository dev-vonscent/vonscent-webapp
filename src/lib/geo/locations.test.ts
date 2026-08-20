import { describe, it, expect } from "vitest";
import {
  AIMAGS,
  getChildren,
  childLabel,
  resolveAdm2,
  formatLocation,
  ULAANBAATAR_CODE,
  getKhoroos,
  formatKhoroo,
} from "@/lib/geo/locations";
import { composeDetail } from "@/features/checkout/components/address-fields";

describe("mn locations", () => {
  it("has 22 adm1 and 339 adm2", () => {
    expect(AIMAGS).toHaveLength(22);
    expect(AIMAGS.reduce((n, a) => n + a.children.length, 0)).toBe(339);
  });

  it("lists Ulaanbaatar first with its 9 districts", () => {
    expect(AIMAGS[0].code).toBe(ULAANBAATAR_CODE);
    expect(AIMAGS[0].name).toBe("Улаанбаатар");
    expect(getChildren(ULAANBAATAR_CODE)).toHaveLength(9);
  });

  it("sorts Ө/Ү in Mongolian alphabetical order, ignoring hyphens", () => {
    const names = AIMAGS.slice(1).map((a) => a.name);
    expect(names.indexOf("Баян-Өлгий")).toBeLessThan(
      names.indexOf("Баянхонгор"),
    );
    expect(names.indexOf("Өвөрхангай")).toBeGreaterThan(names.indexOf("Орхон"));
  });

  it("labels the second select per region type", () => {
    expect(childLabel(ULAANBAATAR_CODE)).toBe("Дүүрэг");
    expect(childLabel("MN45")).toBe("Сум");
  });

  it("resolves an adm2 code back to its pair", () => {
    expect(resolveAdm2("MN1107")?.child.name).toBe("Баянгол");
    expect(formatLocation("MN1107")).toBe("Улаанбаатар, Баянгол");
    expect(resolveAdm2("NOPE")).toBeNull();
    expect(formatLocation(null)).toBe("");
  });

  it("has unique adm2 codes", () => {
    const all = AIMAGS.flatMap((a) => a.children.map((c) => c.code));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("khoroo data", () => {
  it("gives every capital district a 1..N khoroo list, 204 total", () => {
    const ub = AIMAGS[0];
    const total = ub.children.reduce((n, c) => n + (c.khoroos?.length ?? 0), 0);
    expect(total).toBe(204);
    for (const c of ub.children) {
      expect(c.khoroos?.[0]).toBe(1);
      expect(c.khoroos?.at(-1)).toBe(c.khoroos?.length);
    }
  });

  it("gives сум no khoroos — countryside stops at сум", () => {
    const arkhangai = AIMAGS.find((a) => a.name === "Архангай")!;
    expect(arkhangai.children.every((c) => c.khoroos === undefined)).toBe(true);
    expect(getKhoroos(arkhangai.children[0].code)).toEqual([]);
  });

  it("formats khoroo the Mongolian way", () => {
    expect(formatKhoroo(12)).toBe("12-р хороо");
  });

  it("composes khoroo into the detail line", () => {
    expect(composeDetail(12, "45-р байр 12 тоот")).toBe(
      "12-р хороо, 45-р байр 12 тоот",
    );
    expect(composeDetail(null, "45-р байр")).toBe("45-р байр");
    expect(composeDetail(3, "  ")).toBe("3-р хороо");
  });
});
