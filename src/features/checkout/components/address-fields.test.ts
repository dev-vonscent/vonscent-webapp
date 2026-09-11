import { describe, expect, it } from "vitest";
import { composeDetail, splitDetail } from "./address-fields";

describe("splitDetail", () => {
  it("pulls the khoroo back out of a composed line", () => {
    expect(splitDetail("12-р хороо, 45-р байр 12 тоот")).toEqual({
      khoroo: 12,
      detail: "45-р байр 12 тоот",
    });
  });

  it("round-trips whatever composeDetail wrote", () => {
    for (const khoroo of [null, 1, 7]) {
      const detail = "45-р байр 12 тоот";
      expect(splitDetail(composeDetail(khoroo, detail))).toEqual({
        khoroo,
        detail,
      });
    }
  });

  it("handles a khoroo-only line", () => {
    expect(splitDetail("3-р хороо")).toEqual({ khoroo: 3, detail: "" });
  });

  it("leaves a countryside line untouched", () => {
    expect(splitDetail("Сумын товч, 4 тоот")).toEqual({
      khoroo: null,
      detail: "Сумын товч, 4 тоот",
    });
  });
});
