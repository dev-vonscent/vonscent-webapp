"use client";

import { useId, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Гарчгийн хажуух тайлбар — ⓘ дээр hover эсвэл focus хийхэд гарна.
 *
 * Hover-оос гадна focus-оор нээгддэг тул утсан дээр товшиход ч харагдана
 * (touch-д hover байхгүй). Тайлбар нь `aria-describedby`-гаар товчтой
 * холбогдож, дэлгэц уншигчид үргэлж хүрнэ.
 */
export function InfoTip({
  children,
  label = "Тайлбар",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn("group relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-2"
      >
        <Info className="size-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className="bg-popover text-popover-foreground shadow-lift invisible absolute top-full left-0 z-50 mt-2 w-64 max-w-[80vw] rounded-md border px-3 py-2 font-sans text-xs/relaxed font-normal opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
