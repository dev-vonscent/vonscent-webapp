"use client";

import * as React from "react";
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { useFieldProps } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Чөлөөт текст + санал болгох жагсаалт (брэнд г.м.) — `<datalist>`-ийн
 * сайтын загвартай орлуулагч.
 *
 * `<datalist>`-ийг ХЭРЭГЛЭХГҮЙ: жагсаалтыг хөтөч өөрөө (Chrome-д бараан
 * системийн цонх) зурдаг тул theme, фонт, dark mode-д огт захирагдахгүй.
 * Энэ нь Base UI Autocomplete дээр, `ComboboxContent`-тэй ижил popup.
 *
 * Жагсаалтад байхгүй утга бичиж болно (Combobox-оос ялгаа нь энэ). Тохирох
 * зүйл байхгүй үед popup нуугдана.
 */
export const TextAutocomplete = React.forwardRef<
  HTMLInputElement,
  {
    items: readonly string[];
    value: string;
    onValueChange: (value: string) => void;
    onBlur?: () => void;
    name?: string;
    placeholder?: string;
    className?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    id?: string;
  }
>(function TextAutocomplete(
  {
    items,
    value,
    onValueChange,
    onBlur,
    name,
    placeholder,
    className,
    ...aria
  },
  ref,
) {
  const field = useFieldProps(aria);
  return (
    <AutocompletePrimitive.Root
      items={items}
      value={value}
      onValueChange={(v) => onValueChange(v)}
      openOnInputClick
    >
      <AutocompletePrimitive.Input
        ref={ref}
        name={name}
        placeholder={placeholder}
        onBlur={onBlur}
        autoComplete="off"
        className={cn(
          // text-base on mobile: iOS Safari auto-zooms on focus below 16px
          "bg-secondary placeholder:text-muted-foreground field-edge flex h-10 w-full rounded-md px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        {...field}
      />
      <AutocompletePrimitive.Portal>
        <AutocompletePrimitive.Positioner
          align="start"
          sideOffset={4}
          className="z-50 outline-none data-empty:hidden"
        >
          <AutocompletePrimitive.Popup className="border-border bg-popover text-popover-foreground flex max-h-[min(18rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-md border shadow-md transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <AutocompletePrimitive.List className="overflow-y-auto overscroll-contain p-1">
              {(item: string) => (
                <AutocompletePrimitive.Item
                  key={item}
                  value={item}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                >
                  {item}
                </AutocompletePrimitive.Item>
              )}
            </AutocompletePrimitive.List>
          </AutocompletePrimitive.Popup>
        </AutocompletePrimitive.Positioner>
      </AutocompletePrimitive.Portal>
    </AutocompletePrimitive.Root>
  );
});
