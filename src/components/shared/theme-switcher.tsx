"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "black", label: "Хар", swatch: "#000000" },
  { value: "white", label: "Цагаан", swatch: "#ffffff" },
  { value: "pink", label: "Ягаан", swatch: "#c2245c" },
] as const;

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {THEMES.map((t) => {
        const active = mounted && theme === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            aria-label={t.label}
            aria-pressed={active}
            title={t.label}
            className={cn(
              "border-foreground/20 ring-offset-background size-7 rounded-full border ring-offset-2 transition-all",
              active
                ? "ring-foreground ring-2"
                : "hover:scale-110 active:scale-95",
            )}
            style={{ backgroundColor: t.swatch }}
          />
        );
      })}
    </div>
  );
}
