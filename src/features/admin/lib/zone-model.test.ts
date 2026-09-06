import { describe, expect, it } from "vitest";
import { SHIPPING_ZONES, type ShippingZoneConfig } from "@/lib/constants";
import { resolveZone } from "@/lib/geo/zone";
import {
  AIMAG_GROUP,
  buildGroups,
  readAssignments,
  writeAssignments,
} from "./zone-model";

const seed = () => SHIPPING_ZONES.map((z) => ({ ...z })) as ShippingZoneConfig[];

/** Баянгол (34 хороо) — the district the seed puts wholesale into zone A. */
const BAYANGOL = "MN1107";

describe("zone-model", () => {
  it("groups the capital by district and the rest under Аймгууд", () => {
    const groups = buildGroups(seed());
    expect(groups).toHaveLength(10);
    expect(groups.at(-1)?.id).toBe(AIMAG_GROUP);
    expect(groups.find((g) => g.id === BAYANGOL)?.units).toHaveLength(34);
    // One chip per аймаг, not per сум, while no аймаг is split.
    expect(groups.at(-1)?.units).toHaveLength(21);
  });

  it("labels a chip with the khoroo number alone", () => {
    const unit = buildGroups(seed())
      .find((g) => g.id === BAYANGOL)!
      .units.find((u) => u.key === `${BAYANGOL}:5`)!;
    expect(unit.label).toBe("5");
  });

  it("expands a district-wide key onto every khoroo of the district", () => {
    const zones = seed();
    const a = readAssignments(zones, buildGroups(zones));
    expect(a[`${BAYANGOL}:1`]).toBe("A");
    expect(a[`${BAYANGOL}:34`]).toBe("A");
    expect(a["MN1110:7"]).toBe("B"); // Баянзүрх
    expect(a["aimag:MN64"]).toBeUndefined(); // countryside unassigned in the seed
  });

  it("round-trips the shipped defaults unchanged", () => {
    const zones = seed();
    const groups = buildGroups(zones);
    const back = writeAssignments(zones, groups, readAssignments(zones, groups));
    for (const [i, z] of back.entries()) {
      expect([...(z.areas ?? [])].sort()).toEqual(
        [...(zones[i].areas ?? [])].sort(),
      );
    }
  });

  it("writes khoroo keys once a district stops being whole", () => {
    const zones = seed();
    const groups = buildGroups(zones);
    const moved = { ...readAssignments(zones, groups), [`${BAYANGOL}:5`]: "C" };
    const back = writeAssignments(zones, groups, moved);

    const a = back.find((z) => z.code === "A")!;
    const c = back.find((z) => z.code === "C")!;
    expect(c.areas).toEqual([`${BAYANGOL}:5`]);
    expect(a.areas).not.toContain(BAYANGOL);
    expect(a.areas).toHaveLength(33 + 3); // Баянгол хороод + 3 whole districts
    expect(a.areas).not.toContain(`${BAYANGOL}:5`);

    // The checkout lookup agrees with what the operator saw.
    const at = (khoroo: number) =>
      resolveZone(back, {
        city: "Улаанбаатар",
        district: "Баянгол",
        khoroo,
      });
    expect(at(5)).toBe("C");
    expect(at(6)).toBe("A");
  });

  it("keeps a khoroo out of two zones at once", () => {
    const zones = seed();
    const groups = buildGroups(zones);
    const back = writeAssignments(zones, groups, {
      ...readAssignments(zones, groups),
      "MN1110:7": "A",
    });
    const holders = back.filter((z) =>
      (z.areas ?? []).some((k) => k === "MN1110:7" || k === "MN1110"),
    );
    expect(holders.map((z) => z.code)).toEqual(["A"]);
  });

  it("moves a whole аймаг as one unit", () => {
    const zones = seed();
    const groups = buildGroups(zones);
    const khovd = groups
      .at(-1)!
      .units.find((u) => u.label === "Ховд")!;
    const back = writeAssignments(zones, groups, {
      ...readAssignments(zones, groups),
      [khovd.key]: "R",
    });
    const r = back.find((z) => z.code === "R")!;
    // R already seeds the three outlying capital districts; Ховд joins them.
    expect(r.areas).toEqual(expect.arrayContaining(khovd.areas));
    expect(r.areas).toContain("MN1101");
    expect(
      resolveZone(back, { city: "Ховд", district: "Булган", khoroo: null }),
    ).toBe("R");
  });

  it("falls back to сум units for an аймаг split across zones", () => {
    const zones = seed();
    const sums = AIMAG_SUMS();
    zones[3].areas = [sums[0]];
    zones[4].areas = [...(zones[4].areas ?? []), sums[1]];
    const aimagUnits = buildGroups(zones).at(-1)!.units;
    // The split аймаг contributes its сум individually; the other 20 stay whole.
    expect(aimagUnits.filter((u) => u.key.startsWith("aimag:"))).toHaveLength(20);
    expect(aimagUnits.some((u) => u.key === sums[0])).toBe(true);
  });

});

/** сум codes of the first countryside аймаг, for the split-аймаг case. */
function AIMAG_SUMS(): string[] {
  const unit = buildGroups(seed())
    .at(-1)!
    .units.find((u) => u.key.startsWith("aimag:"))!;
  return unit.areas;
}
