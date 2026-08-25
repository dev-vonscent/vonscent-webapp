"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Progress indicator for the one-page checkout (1f). Purely a pointer: the
 * page never splits into steps — an IntersectionObserver highlights whichever
 * form section is in view, and clicking a step scrolls to it.
 */
export const CHECKOUT_STEPS = [
  { id: "step-contact", label: "Холбоо барих" },
  { id: "step-shipping", label: "Хүргэлт" },
  { id: "step-payment", label: "Төлбөр" },
] as const;

export function CheckoutStepper() {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const els = CHECKOUT_STEPS.map((s) => document.getElementById(s.id));
    // A horizontal band around the upper-middle of the viewport: whichever
    // section crosses it is the "current" step.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = els.indexOf(e.target as HTMLElement);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: "-30% 0px -55% 0px" },
    );
    for (const el of els) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3" aria-label="Алхамууд">
      {CHECKOUT_STEPS.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById(s.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            aria-current={i === active ? "step" : undefined}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i === active
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium transition-colors sm:text-sm",
                i === active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </button>
          {i < CHECKOUT_STEPS.length - 1 && (
            <span className="bg-border h-px flex-1" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}
