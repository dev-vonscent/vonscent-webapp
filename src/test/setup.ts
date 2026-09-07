import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Pointer-capture and scroll APIs jsdom does not implement.
 *
 * Radix's Select (and the other primitives built on the same foundation)
 * calls these while opening a menu, so without them any test that clicks a
 * dropdown dies with `target.hasPointerCapture is not a function` — a jsdom
 * gap, not a bug in the component under test. No-ops are enough: the tests
 * assert on what the menu renders, not on pointer capture.
 */
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}

/**
 * `window.matchMedia`, which jsdom also leaves out.
 *
 * Several components ask the browser a media question on mount —
 * `usePrefersReducedMotion`, `ResponsiveDialog`'s desktop check, the profile
 * tiles' hover-capability check — and without this they throw before
 * rendering anything. Everything reports "no match", i.e. the mobile,
 * full-motion baseline; a test that cares about the other answer overrides
 * this itself.
 */
if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(() => {
  cleanup();
});
