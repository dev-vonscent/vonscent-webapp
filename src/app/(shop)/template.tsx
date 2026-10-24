"use client";

import * as React from "react";
import { MotionConfig, motion } from "motion/react";

/**
 * False once the first page of this document has mounted. On the server it
 * never flips (no effects run there), so SSR and hydration agree.
 */
let firstPage = true;

/**
 * Soft entrance on every shop navigation. `template.tsx` remounts per route,
 * which is exactly what retriggers the animation; `reducedMotion="user"`
 * turns transform animations off for people who asked the OS for less motion.
 *
 * The first page of a visit does NOT animate: `initial={{ opacity: 0 }}` is
 * rendered into the SSR HTML, so the whole page stayed invisible until the
 * JS had loaded and hydrated — Lighthouse mobile LCP was ~8s with the hero
 * image downloaded at 1.7s. Only client-side navigations fade in.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const [animate] = React.useState(() => !firstPage);
  React.useEffect(() => {
    firstPage = false;
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={animate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
