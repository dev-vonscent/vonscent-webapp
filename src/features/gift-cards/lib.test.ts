import { describe, expect, it } from "vitest";
import { normalizeGiftCode } from "./lib";

describe("normalizeGiftCode", () => {
  it("accepts the canonical form", () => {
    expect(normalizeGiftCode("VON-8X56-AFR7")).toBe("VON-8X56-AFR7");
  });
  it("accepts lowercase, spaces and missing dashes like the RPC", () => {
    expect(normalizeGiftCode("von8x56afr7")).toBe("VON-8X56-AFR7");
    expect(normalizeGiftCode(" VON 8X56 AFR7 ")).toBe("VON-8X56-AFR7");
    expect(normalizeGiftCode("8x56-afr7")).toBe("VON-8X56-AFR7");
  });
  it("rejects anything else", () => {
    expect(normalizeGiftCode("VON-8X56")).toBeNull();
    expect(normalizeGiftCode("")).toBeNull();
  });
});
