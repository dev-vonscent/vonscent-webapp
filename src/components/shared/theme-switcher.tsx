"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Dark (black) ↔ light (white) switch. navy/pink-ийг providers-д white руу буулгадаг. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const dark = !mounted || theme === "black" || theme === undefined;
  const Icon = dark ? Moon : Sun;

  /** Шинэ theme switch-ээс дугуйлан тэлж нээгдэнэ (View Transitions API).
   *  Дэмжихгүй browser эсвэл reduced motion үед шууд солигдоно. */
  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = dark ? "white" : "black";
    if (reduce || !document.startViewTransition) {
      setTheme(next);
      return;
    }

    const { left, top, width, height } =
      e.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const root = document.documentElement;

    // transition-colors-тай элементүүд дугуй тэлэх зуур хагас өнгөтэй
    // анивчихгүйн тулд шилжилт дуустал бүх CSS transition-ийг унтраана.
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);

    const transition = document.startViewTransition(() => {
      // next-themes class-аа effect дотор солих тул snapshot-оос өмнө гараар солино.
      root.classList.remove("black", "white", "navy", "pink");
      root.classList.add(next);
      flushSync(() => setTheme(next));
    });

    void transition.ready.then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 600,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          // both: эхний frame-ээс clip-тэй, сүүлийнх нь бүтэн хэвээр үлдэнэ.
          fill: "both",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });

    void transition.finished.finally(() => freeze.remove());
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Бараан горим"
      title={dark ? "Бараан горим" : "Цайвар горим"}
      onClick={toggle}
      className={cn(
        "border-foreground/20 bg-foreground/15 focus-visible:ring-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 focus-visible:ring-2 focus-visible:outline-none",
        dark ? "justify-end" : "justify-start",
        className,
      )}
    >
      <motion.span
        layout={!reduce}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="bg-background text-foreground pointer-events-none relative inline-flex size-5.5 items-center justify-center overflow-hidden rounded-full shadow-sm"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={dark ? "moon" : "sun"}
            initial={reduce ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={reduce ? undefined : { rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="inline-flex"
          >
            <Icon className="size-3.5" strokeWidth={2.25} />
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
