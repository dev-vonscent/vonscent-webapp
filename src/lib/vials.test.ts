import { describe, expect, it } from "vitest";
import { defaultVialStyle, vialName, vialStyleFor } from "./vials";

describe("vialStyleFor", () => {
  it("хүйсээр өгөгдмөл өнгө", () => {
    expect(defaultVialStyle("male")).toBe("black");
    expect(defaultVialStyle("female")).toBe("pink");
    expect(defaultVialStyle("unisex")).toBe("silver");
  });

  it("override > барааны өнгө > хүйс", () => {
    const base = { ml: 10, gender: "male" as const, vialStyle: null };
    expect(vialStyleFor(base)).toBe("black");
    expect(vialStyleFor({ ...base, vialStyle: "pink" })).toBe("pink");
    expect(
      vialStyleFor({ ...base, vialStyle: "pink", overrideStyle: "silver" }),
    ).toBe("silver");
  });

  it("2ml, 1ml сав өнгөгүй", () => {
    expect(
      vialStyleFor({ ml: 2, gender: "female", vialStyle: "pink" }),
    ).toBeNull();
    expect(
      vialStyleFor({ ml: 1, gender: "female", vialStyle: null }),
    ).toBeNull();
  });
});

describe("vialName", () => {
  it("өнгөтэй ба өнгөгүй", () => {
    expect(vialName({ style: "pink", ml: 10 })).toBe("Ягаан 10ml");
    expect(vialName({ style: null, ml: 2 })).toBe("2ml сав");
  });
});
