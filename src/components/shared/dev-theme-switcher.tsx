"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "black", label: "Хар", swatch: "#000000" },
  { value: "white", label: "Цагаан", swatch: "#ffffff" },
  { value: "pink", label: "Ягаан", swatch: "#c2245c" },
] as const;

const COLLAPSED_KEY = "dev-theme-switcher-collapsed";

/**
 * Development-only theme switcher, floating bottom-right on every screen.
 *
 * The Three Moods rule says every surface has to survive `.black`, `.white` and
 * `.pink` — but the only switcher in the product lives on the account page, so
 * checking a admin dialog or a checkout step meant navigating away from the
 * thing being checked and back. This puts all three a click away from wherever
 * you are.
 *
 * Rendered only when `NODE_ENV === "development"`; the layout's guard is a
 * build-time constant, so this file is dead-code-eliminated from production.
 *
 * It collapses, because a permanent floating control in a corner eventually
 * covers the one button someone needs to click — and it sits above the mobile
 * BottomNav rather than on top of it.
 */
export function DevThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // Open by default: the point is to have the three moods one click away on
  // every screen, so hiding them behind a handle defeats it. Collapsing is
  // opt-in and remembered.
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Private mode / storage disabled — the default stands.
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Not worth failing the interaction over.
      }
      return next;
    });
  }

  // Nothing until next-themes has resolved, or the swatch ring would flash on
  // the wrong colour during hydration.
  if (!mounted) return null;

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <div
      // Clears the mobile BottomNav (`h-safe-nav`, 4rem + inset) on phones and
      // sits in the ordinary corner from `md` up. Above the nav's z-40.
      className="pb-safe fixed right-4 bottom-20 z-50 md:bottom-4 print:hidden"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          aria-label={`Загвар солих (одоо: ${current.label})`}
          title={`Dev: загвар солих — одоо ${current.label}`}
          className="bg-secondary/85 shadow-lift flex size-10 items-center justify-center rounded-full backdrop-blur transition-transform active:scale-95"
        >
          <span
            aria-hidden
            className="ring-foreground/30 size-5 rounded-full ring-1"
            style={{ backgroundColor: current.swatch }}
          />
        </button>
      ) : (
        // The Glass Trio: translucent surface + blur + lift. Capsule, because
        // in this system a round shape means "floating or pressable".
        <div className="bg-secondary/85 shadow-lift flex items-center gap-2 rounded-full py-2 pr-2 pl-3 backdrop-blur">
          <span
            aria-hidden
            className="text-muted-foreground text-[11px] font-semibold tracking-[0.15em] uppercase"
          >
            dev
          </span>
          {THEMES.map((t) => {
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                aria-label={t.label}
                aria-pressed={active}
                title={t.label}
                className={cn(
                  "ring-offset-secondary size-7 rounded-full ring-offset-2 transition-all",
                  active
                    ? "ring-foreground ring-2"
                    : "ring-foreground/20 ring-1 hover:scale-110 active:scale-95",
                )}
                style={{ backgroundColor: t.swatch }}
              />
            );
          })}
          <button
            type="button"
            onClick={toggle}
            aria-expanded
            aria-label="Хураах"
            title="Хураах"
            className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
