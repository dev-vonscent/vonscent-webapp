"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Сагсны мөр сонгох checkbox — 20px. Үндсэн 16px нь 80px зурагны хажууд
 * жижиг харагдаж, аль мөр захиалгад орохыг нүдээр ялгахад хэцүү байв.
 * Дарах талбай (44px) нь үндсэн компонентод аль хэдийн бий.
 */
export function CartCheckbox({
  className,
  ...props
}: React.ComponentProps<typeof Checkbox>) {
  return (
    <Checkbox className={cn("size-5 [&_svg]:size-4", className)} {...props} />
  );
}
