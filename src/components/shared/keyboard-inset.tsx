"use client";

import * as React from "react";

/**
 * Publishes the on-screen keyboard and the visible area as CSS variables on
 * <html>:
 *
 * - `--kb-inset` — the keyboard height (`innerHeight − visualViewport.height`).
 *   For in-flow layouts (auth pages): bottom padding of this size gives the
 *   document room to scroll the field above the keyboard.
 * - `--vv-bottom` — where the *visible* area ends, measured up from the layout
 *   viewport's bottom edge, signed. `bottom: var(--vv-bottom)` pins a
 *   `position: fixed` sheet to exactly what the visitor sees.
 * - `--vv-height` — the visible height, to cap that sheet.
 *
 * iOS Safari never shrinks the layout viewport for the keyboard; it pans the
 * visual viewport instead (`offsetTop`), by an amount of its own choosing. A
 * fixed sheet anchored at `bottom: 0` therefore lands wherever the layout
 * viewport happens to end: padding it by the full keyboard height compensated
 * twice (fields shot off the top), and clamping the difference at 0 left a gap
 * — on iOS 26 the pan overshoots behind the floating URL pill and keyboard
 * toolbar, so the page showed through between sheet and keys. Hence signed.
 *
 * On Android the layout viewport already resizes (see `interactiveWidget` in
 * the root layout), so these measure ~0 / full height. Renders nothing.
 */
export function KeyboardInset() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;

    const measure = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      const bottom = window.innerHeight - (vv.offsetTop + vv.height);
      root.setProperty("--kb-inset", `${inset}px`);
      root.setProperty("--vv-bottom", `${Math.round(bottom)}px`);
      root.setProperty("--vv-height", `${Math.round(vv.height)}px`);
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
        // Sheet дотор «nearest»: талбар аль хэдийн харагдаж байвал хөдөлгөхгүй.
        const block = el.closest("[role=dialog]") ? "nearest" : "center";
        requestAnimationFrame(() =>
          el.scrollIntoView({ block, behavior: "smooth" }),
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
      root.removeProperty("--vv-bottom");
      root.removeProperty("--vv-height");
    };
  }, []);

  return null;
}
