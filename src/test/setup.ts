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

afterEach(() => {
  cleanup();
});
