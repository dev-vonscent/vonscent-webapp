"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom";
type Align = "start" | "center" | "end";

const ALIGN: Record<Align, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

/**
 * Сайтын tooltip — browser-ийн `title`-ийн оронд. Hover (бага зэрэг
 * хоцроож) эсвэл гарын focus дээр гарна; `aria-describedby`-гаар хүүхэд
 * элементтэй холбогдоно. CSS-ээр л ажиллана (JS байрлал тооцоолохгүй) —
 * `side` / `align`-аар дэлгэцийн ирмэгээс зайлуулна.
 */
export function Tooltip({
  content,
  children,
  side = "bottom",
  align = "center",
  className,
  contentClassName,
}: {
  content: React.ReactNode;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  side?: Side;
  align?: Align;
  className?: string;
  /** Бөмбөлгийн нэмэлт класс (жишээ нь `lg:hidden`). */
  contentClassName?: string;
}) {
  const id = React.useId();
  if (content == null || content === false || content === "") return children;
  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], id]
          .filter(Boolean)
          .join(" "),
      })
    : children;
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {child}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "bg-popover text-popover-foreground shadow-lift pointer-events-none invisible absolute z-50 w-max max-w-72 rounded-md px-2.5 py-1.5 text-left font-sans text-xs/relaxed font-normal tracking-normal whitespace-normal normal-case opacity-0 transition-opacity delay-0 group-hover/tip:visible group-hover/tip:opacity-100 group-hover/tip:delay-150 group-has-focus-visible/tip:visible group-has-focus-visible/tip:opacity-100 motion-reduce:transition-none",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          ALIGN[align],
          contentClassName,
        )}
      >
        {content}
      </span>
    </span>
  );
}
