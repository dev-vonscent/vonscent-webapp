"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldProps } from "@/components/ui/field";

/**
 * Хайж сонгодог `Select` — урт (хэдэн зуу+) жагсаалтад.
 *
 * Base UI-ийн Combobox дээр «input inside popup» загвараар: гаднаасаа
 * `SelectTrigger`-тэй яг адилхан, нээхэд дээд талдаа хайлтын талбартай.
 * Radix Select хайлтгүй, cmdk нь command palette (ARIA combobox биш) тул
 * энэ хослолыг сонгосон. 2–10 сонголттой газарт энгийн `Select` хэвээр.
 *
 * Сервер дээр хайх бол `filter={null}` + `onInputValueChange` (жишээ:
 * `features/admin/components/customer-picker.tsx`).
 */
export const Combobox = ComboboxPrimitive.Root;
export const ComboboxValue = ComboboxPrimitive.Value;
export const ComboboxList = ComboboxPrimitive.List;

export function ComboboxTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
  return (
    <ComboboxPrimitive.Trigger
      className={cn(
        "bg-secondary field-edge data-placeholder:text-muted-foreground flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      {...useFieldProps(props)}
    >
      {children}
      <ComboboxPrimitive.Icon className="shrink-0">
        <ChevronDown className="size-4 opacity-50" />
      </ComboboxPrimitive.Icon>
    </ComboboxPrimitive.Trigger>
  );
}

export function ComboboxContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align="start"
        sideOffset={4}
        className="z-50 outline-none"
      >
        <ComboboxPrimitive.Popup
          className={cn(
            "border-border bg-popover text-popover-foreground flex max-h-[min(24rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) min-w-56 origin-(--transform-origin) flex-col overflow-hidden rounded-md border shadow-md transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

/** Popup-ийн дээд талын хайлтын талбар. */
export function ComboboxInput({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <div className="border-border flex items-center gap-2 border-b px-3">
      <Search className="text-muted-foreground size-4 shrink-0" />
      <ComboboxPrimitive.Input
        className={cn(
          // text-base on mobile: iOS Safari auto-zooms on focus below 16px
          "placeholder:text-muted-foreground h-10 w-full bg-transparent text-base outline-none md:text-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** Гүйдэг хэсэг — `Status`, `Empty`, `List`-ийг багтаана. */
export function ComboboxScroll({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-y-auto overscroll-contain p-1", className)}
      {...props}
    />
  );
}

/** Check баруун талд — `SelectItem`-тэй ижил (текст trigger-тэй нэг шугамд). */
export function ComboboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-3.5 items-center justify-center">
        <Check className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

/** Ачаалж буй / алдааны мөр — дэлгэц уншигчид `aria-live`-аар зарлагдана. */
export function ComboboxStatus({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Status>) {
  return (
    <ComboboxPrimitive.Status
      className={cn(
        "text-muted-foreground flex items-center gap-2 px-2 text-sm not-empty:py-1.5 empty:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function ComboboxEmpty({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      className={cn(
        "text-muted-foreground px-2 text-center text-sm not-empty:py-6 empty:hidden",
        className,
      )}
      {...props}
    />
  );
}
