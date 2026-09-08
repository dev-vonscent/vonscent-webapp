"use client";

import * as React from "react";

/**
 * Can this device actually hand off to a banking app?
 *
 * A `khanbank://` link is only useful where the app exists. On a desktop
 * browser the same click produces "Safari can't open the page because the
 * address is invalid" — a dead end dressed up as the primary action. So the
 * payment page leads with the app grid on a phone and with the QR on a
 * desktop, and the icons stop being links where they cannot work.
 *
 * `(pointer: coarse)` rather than a width breakpoint: what matters is whether
 * the device is a phone or tablet, not how wide the window happens to be. A
 * half-width browser on a laptop still cannot open Хаан банк.
 *
 * Defaults to `true` so the first paint on a phone — the case that matters —
 * is already correct, and a desktop quietly downgrades on mount.
 */
export function useCanOpenApps(): boolean {
  const [coarse, setCoarse] = React.useState(true);

  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return coarse;
}
