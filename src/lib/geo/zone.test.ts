import { describe, it, expect } from "vitest";
import { adm2CodeFor, areaKey, resolveZone } from "@/lib/geo/zone";

const ZONES = [
  { name: "А бүс", areas: ["MN1107:1", "MN1107:2"] },
  { name: "Б бүс", areas: ["MN1107", "MN1101"] },
  { name: "Орон нутаг", areas: ["MN4501"] },
  { name: "Гар аргаар", areas: [] },
];

describe("delivery zone resolution", () => {
  it("maps a Cyrillic pair back to its adm2 code", () => {
    expect(adm2CodeFor("Улаанбаатар", "Баянгол")).toBe("MN1107");
    expect(adm2CodeFor("Улаанбаатар", "Байхгүй")).toBeNull();
  });

  it("prefers a khoroo rule over the district it sits in", () => {
    expect(
      resolveZone(ZONES, {
        city: "Улаанбаатар",
        district: "Баянгол",
        khoroo: 2,
      }),
    ).toBe("А бүс");
  });

  it("falls back to the district rule for other khoroos", () => {
    expect(
      resolveZone(ZONES, {
        city: "Улаанбаатар",
        district: "Баянгол",
        khoroo: 20,
      }),
    ).toBe("Б бүс");
  });

  it("resolves a district with no khoroo given", () => {
    expect(
      resolveZone(ZONES, { city: "Улаанбаатар", district: "Багануур" }),
    ).toBe("Б бүс");
  });

  it("returns null when nothing covers the address", () => {
    expect(
      resolveZone(ZONES, { city: "Улаанбаатар", district: "Сүхбаатар" }),
    ).toBeNull();
    // An unmapped address must not silently pick the first zone.
    expect(resolveZone(ZONES, { city: "—", district: "—" })).toBeNull();
  });

  it("ignores zones the admin has not mapped yet", () => {
    expect(
      resolveZone([{ name: "Гар аргаар" }], {
        city: "Улаанбаатар",
        district: "Баянгол",
        khoroo: 1,
      }),
    ).toBeNull();
  });

  it("writes area keys the admin UI stores", () => {
    expect(areaKey("MN1107")).toBe("MN1107");
    expect(areaKey("MN1107", 12)).toBe("MN1107:12");
  });
});
