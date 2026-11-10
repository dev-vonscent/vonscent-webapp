import { describe, expect, it } from "vitest";
import { bottleKind, isCostless } from "./bottle-kind";

describe("bottleKind", () => {
  it("гурван шилийг ангилал + горимоос ялгана", () => {
    expect(bottleKind("empty-bottle", "local_quantity")).toBe("empty");
    expect(bottleKind("bottled", "local_quantity")).toBe("sealed");
    expect(bottleKind("bottled", "leftover_liquid")).toBe("leftover");
    expect(bottleKind("syringe", "local_quantity")).toBeNull();
    expect(bottleKind("gift-box", "local_quantity")).toBeNull();
  });

  it("зөвхөн хоосон шил өртөггүй", () => {
    expect(isCostless("empty")).toBe(true);
    expect(isCostless("sealed")).toBe(false);
    expect(isCostless("leftover")).toBe(false);
    expect(isCostless(null)).toBe(false);
  });
});
