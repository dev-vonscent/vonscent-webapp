"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldProps } from "@/components/ui/field";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  const field = useFieldProps(props);
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        // text-base on mobile: iOS Safari auto-zooms on focus below 16px
        "bg-secondary placeholder:text-muted-foreground field-edge flex h-10 w-full rounded-md px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...field}
    />
  );
});
Input.displayName = "Input";
