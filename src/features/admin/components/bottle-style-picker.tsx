"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  BOTTLE_STYLES,
  BOTTLE_STYLE_LABEL,
  BOTTLE_STYLE_PREVIEW,
  type BottleStyle,
} from "@/lib/constants";

/**
 * Шинэ бараанд галерейд нэмэх савны зургийг сонгоно. «Нэмэхгүй» нь анхдагч —
 * сав бүтээгдэхүүн бүрт тохирохгүй тул админ өөрөө шийднэ.
 */
export function BottleStylePicker({
  value,
  onChange,
}: {
  value: BottleStyle | null;
  onChange: (v: BottleStyle | null) => void;
}) {
  const options: { value: BottleStyle | null; label: string }[] = [
    { value: null, label: "Нэмэхгүй" },
    ...BOTTLE_STYLES.map((s) => ({ value: s, label: BOTTLE_STYLE_LABEL[s] })),
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Савны зураг"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value ?? "none"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
              active
                ? "border-foreground bg-secondary font-medium"
                : "border-border hover:bg-accent",
            )}
          >
            <span className="bg-muted relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md">
              {o.value ? (
                <Image
                  src={BOTTLE_STYLE_PREVIEW[o.value]}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 160px, 45vw"
                  className="object-cover"
                />
              ) : (
                <span aria-hidden className="text-muted-foreground text-xs">
                  —
                </span>
              )}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
