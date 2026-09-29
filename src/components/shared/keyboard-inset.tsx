"use client";

import * as React from "react";

/**
 * Publishes the on-screen keyboard as two CSS variables on <html>:
 *
 * - `--kb-inset` — the keyboard height (`innerHeight − visualViewport.height`).
 *   For in-flow layouts (auth pages): bottom padding of this size gives the
 *   document room to scroll the field above the keyboard.
 * - `--kb-overlap` — how much of the *layout* viewport's bottom edge the
 *   keyboard actually hides right now (`… − visualViewport.offsetTop`). For
 *   `position: fixed` bottom sheets.
 *
 * iOS Safari never shrinks the layout viewport for the keyboard; instead it
 * pans the visual viewport up (`offsetTop`) to reveal the focused field. A
 * fixed sheet is carried up by that pan already, so padding it by the full
 * keyboard height compensated twice: the sheet shot up, its fields left the
 * top of the screen and a keyboard-sized blank band sat above the keys.
 * `--kb-overlap` subtracts the pan, so the sheet ends exactly at the keyboard.
 *
 * On Android the layout viewport already resizes (see `interactiveWidget` in
 * the root layout), so both measure ~0 and this is a no-op. Renders nothing.
 */
export function KeyboardInset() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;

    const measure = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      const overlap = Math.max(0, inset - vv.offsetTop);
      root.setProperty("--kb-inset", `${inset}px`);
      root.setProperty("--kb-overlap", `${overlap}px`);
      return inset;
    };

    const onResize = () => {
      const inset = measure();
      // The padding shift alone can run out of room (the content hits the top
      // of the viewport), so also pull the focused field into view. Only on
      // resize — the keyboard opening — never on the pan below, which would
      // chase its own scroll.
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

    measure();
    vv.addEventListener("resize", onResize);
    // iOS pans the visual viewport after (and independently of) the resize.
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", measure);
      root.removeProperty("--kb-inset");
      root.removeProperty("--kb-overlap");
    };
  }, []);

  return null;
}
