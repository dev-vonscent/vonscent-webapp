import { describe, expect, it } from "vitest";
import { visualBottomGap } from "./visual-viewport-sync";

// iPhone 15: 852px өндөр, гар ~336px.
const base = { innerHeight: 852, offsetTop: 0, height: 852, scale: 1 };

describe("visualBottomGap", () => {
  it("is 0 when the layout and visual viewports agree", () => {
    expect(visualBottomGap(base)).toBe(0);
  });

  it("pulls the bars down when iOS leaves offsetTop stuck after the keyboard", () => {
    // Гар хаагдсан ч offsetTop буцаагүй — зурвас дэлгэцийн дунд (522px) харагдана.
    expect(visualBottomGap({ ...base, offsetTop: 330 })).toBe(-330);
  });

  it("pulls the bars down when innerHeight is left stale and short", () => {
    expect(visualBottomGap({ ...base, innerHeight: 516 })).toBe(-336);
  });

  it("leaves the bars behind an open keyboard", () => {
    expect(visualBottomGap({ ...base, height: 516 })).toBe(0);
    expect(visualBottomGap({ ...base, height: 516, offsetTop: 200 })).toBe(0);
  });

  it("ignores pinch-zoom, where anchoring to the layout viewport is correct", () => {
    expect(
      visualBottomGap({ ...base, scale: 2, height: 426, offsetTop: 100 }),
    ).toBe(0);
  });

  it("ignores sub-pixel jitter", () => {
    expect(visualBottomGap({ ...base, height: 852.6 })).toBe(0);
  });
});
