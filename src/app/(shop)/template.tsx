"use client";

import { MotionConfig, motion } from "motion/react";

/**
 * Soft entrance on every shop navigation. `template.tsx` remounts per route,
 * which is exactly what retriggers the animation; `reducedMotion="user"`
 * turns transform animations off for people who asked the OS for less motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
