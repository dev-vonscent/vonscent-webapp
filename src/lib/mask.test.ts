import { describe, expect, it } from "vitest";
import { maskName, maskPhone } from "./mask";

describe("maskName", () => {
  it("keeps only the first letter", () => {
    expect(maskName("Болд")).toBe("Б***");
    expect(maskName("  сараа ")).toBe("С***");
  });
  it("returns null for empty names", () => {
    expect(maskName("")).toBeNull();
    expect(maskName(null)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("keeps the last four digits", () => {
    expect(maskPhone("99112233")).toBe("••2233");
    expect(maskPhone("+976 9911 2233")).toBe("••2233");
  });
  it("returns null when too short", () => {
    expect(maskPhone("12")).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
  });
});
