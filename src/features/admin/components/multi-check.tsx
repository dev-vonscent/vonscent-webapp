"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface MultiCheckOption {
  value: string;
  label: string;
}

/**
 * Checkbox grid for the attributes a product can hold several of at once —
 * scent families and seasons. Replaces the single-value Selects: a scent is
 * commonly "дорнын + модлог", worn "намар + өвөл".
 */
export function MultiCheck({
  label,
  options,
  selected,
  onToggle,
  empty,
}: {
  label: string;
  options: MultiCheckOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Shown instead of the grid when the taxonomy is empty. */
  empty?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty ?? "Хоосон"}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {options.map((o) => {
            const id = `${label}-${o.value}`;
            return (
              <label
                key={o.value}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(o.value)}
                  onCheckedChange={() => onToggle(o.value)}
                />
                <span className="truncate">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * `useState` helper for the string[] the checkbox grid drives.
 *
 * `exclusive` names a value that cannot coexist with the others — "Бүх улирал"
 * already covers every season, so ticking it clears the individual ones and
 * ticking an individual season drops it.
 */
export function useToggleList(
  initial: string[] = [],
  options: { exclusive?: string } = {},
) {
  const { exclusive } = options;
  const [list, setList] = React.useState<string[]>(initial);
  const toggle = React.useCallback(
    (value: string) => {
      setList((l) => {
        if (l.includes(value)) return l.filter((x) => x !== value);
        if (exclusive !== undefined) {
          if (value === exclusive) return [exclusive];
          return [...l.filter((x) => x !== exclusive), value];
        }
        return [...l, value];
      });
    },
    [exclusive],
  );
  return [list, toggle, setList] as const;
}
