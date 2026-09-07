"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Land at the top of a page you have just opened.
 *
 * The App Router is supposed to do this itself, and on most routes it does.
 * It decides by measuring the first element of the changed segment and skipping
 * the scroll when that element looks like it is already on screen — and in this
 * layout that measurement comes out wrong often enough to be the bug people
 * actually report: tap a perfume from halfway down the home page and the
 * product opens *at the same scroll offset*, showing the reviews instead of the
 * bottle. No `scrollTo` is issued at all; the position is simply carried over.
 * The parallel `@footer` slot is the likeliest reason the segment it measures
 * is not the one that moved.
 *
 * So the reset is made explicit rather than left to the heuristic. Mounted in
 * the shop layout, it stays alive across navigations, which is what lets it
 * tell the two cases apart:
 *
 *   • a fresh navigation (link, router.push) → start at the top;
 *   • back / forward → leave it alone, because the router restores the
 *     position the visitor left, and yanking them to the top would be worse
 *     than the bug this fixes.
 *
 * `popstate` fires before React re-renders with the new pathname, so the flag
 * set here is always read by the effect below for the matching navigation.
 */
export function ScrollReset() {
  const pathname = usePathname();
  const restoring = React.useRef(false);
  const first = React.useRef(true);

  React.useEffect(() => {
    const onPop = () => {
      restoring.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  React.useEffect(() => {
    // The very first render is a full page load: the browser has already put
    // the visitor where they belong (top, a hash target, or a restored
    // position), and this must not fight it.
    if (first.current) {
      first.current = false;
      return;
    }
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    // A link to an anchor owns its own destination.
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
