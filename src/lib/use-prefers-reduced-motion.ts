"use client";

import * as React from "react";

/**
 * Tracks the OS-level "reduce motion" preference. Starts as `false` on the
 * server / first client render, so autoplay etc. must be *disabled* in the
 * effect-driven re-render — never rely on the initial value for a one-shot
 * decision made before the effect runs.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
