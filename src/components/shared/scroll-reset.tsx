"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Хуудас бүрийн сүүлийн гүйлгэлт — URL (path + query) түлхүүртэй. */
const STORAGE_KEY = "vs-scroll-positions";
/** Хуудас хангалттай урт болтол хүлээх дээд хугацаа (infinite grid, зураг). */
const RESTORE_TIMEOUT_MS = 1500;

const urlKey = () => window.location.pathname + window.location.search;

function readPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writePositions(positions: Record<string, number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Private mode / quota — restoration is a convenience, not a requirement.
  }
}

/**
 * Land at the top of a page you have just opened — and back where you were
 * when you return to one.
 *
 * Fresh navigation: the App Router is supposed to scroll to the top itself,
 * but it decides by measuring the first element of the changed segment and
 * skipping the scroll when that element looks like it is already on screen.
 * In this layout that measurement comes out wrong often enough to be the bug
 * people actually report: tap a perfume from halfway down the home page and
 * the product opens *at the same scroll offset*. The parallel `@footer` slot
 * is the likeliest reason the segment it measures is not the one that moved.
 *
 * Back / forward: left to the browser, iOS Safari (and every iOS browser — all
 * WebKit) restores the offset at `popstate`, while the *product* page is still
 * on screen. That page is shorter than the catalog or home it is returning to,
 * so the offset is clamped and the visitor lands at the top. Chromium happens
 * to restore after React renders, which is why it only failed on phones. So
 * restoration is manual too: the offset of every URL is kept in
 * sessionStorage, and on back/forward it is re-applied once the page has grown
 * tall enough to hold it.
 */
export function ScrollReset() {
  const pathname = usePathname();
  const first = React.useRef(true);
  /** Pathname a back/forward is heading to — the reset effect skips it once. */
  const poppedTo = React.useRef<string | null>(null);
  /** While restoring, scroll events are ours (or clamping) — don't record them. */
  const restoring = React.useRef(false);
  const positions = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    positions.current = readPositions();
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";

    let frame = 0;
    const onScroll = () => {
      if (restoring.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        positions.current[urlKey()] = Math.round(window.scrollY);
        writePositions(positions.current);
      });
    };

    let restoreFrame = 0;
    const cancelRestore = () => {
      cancelAnimationFrame(restoreFrame);
      restoring.current = false;
    };
    const restore = (target: number) => {
      cancelRestore();
      // Never scrolled (or at the top): manual mode means the browser will
      // not reset it either, so the product page's offset would carry over.
      if (target <= 0) {
        window.scrollTo(0, 0);
        return;
      }
      restoring.current = true;
      const deadline = performance.now() + RESTORE_TIMEOUT_MS;
      const tick = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max >= target || performance.now() > deadline) {
          window.scrollTo(0, Math.min(target, max));
          restoring.current = false;
          return;
        }
        restoreFrame = requestAnimationFrame(tick);
      };
      restoreFrame = requestAnimationFrame(tick);
    };

    const onPop = () => {
      poppedTo.current = window.location.pathname;
      restore(positions.current[urlKey()] ?? 0);
    };

    // The visitor's own gesture always wins over a pending restore.
    const onGesture = () => {
      if (restoring.current) cancelRestore();
    };

    // A reload or a back/forward into a full page load (bfcache miss) is a
    // return visit as well.
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav && (nav.type === "reload" || nav.type === "back_forward")) {
      restore(positions.current[urlKey()] ?? 0);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    window.addEventListener("touchstart", onGesture, { passive: true });
    window.addEventListener("wheel", onGesture, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelRestore();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("wheel", onGesture);
      history.scrollRestoration = prev;
    };
  }, []);

  React.useEffect(() => {
    // The very first render is a full page load — handled above.
    if (first.current) {
      first.current = false;
      return;
    }
    // Back / forward: the popstate handler owns the position. Matched by
    // pathname so a query-only pop (catalog filters) cannot leave the flag
    // set and swallow the next real navigation's reset.
    if (poppedTo.current === pathname) {
      poppedTo.current = null;
      return;
    }
    poppedTo.current = null;
    // A link to an anchor owns its own destination.
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
