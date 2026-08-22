"use client";

import * as React from "react";

/**
 * Publishes the on-screen keyboard height as `--kb-inset` on <html>.
 * iOS Safari never shrinks the layout viewport for the keyboard (it only
 * shrinks the *visual* viewport), so centered layouts sit behind it; a
 * container can add `var(--kb-inset)` of bottom padding to re-center above
 * the keyboard. On Android the layout viewport already resizes (see
 * `interactiveWidget` in the root layout), so the measured inset is ~0 and
 * this is a no-op. Renders nothing.
 */
export function KeyboardInset() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      document.documentElement.style.setProperty("--kb-inset", `${inset}px`);
      // The padding shift alone can run out of room (the content hits the top
      // of the viewport), so also pull the focused field into view.
      const el = document.activeElement;
      if (
        inset > 0 &&
        el instanceof HTMLElement &&
        el.matches("input,textarea,select")
      ) {
        requestAnimationFrame(() =>
          el.scrollIntoView({ block: "center", behavior: "smooth" }),
        );
      }
    };
    update();
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);

  return null;
}
