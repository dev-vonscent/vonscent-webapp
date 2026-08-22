import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        // text-base on mobile: iOS Safari auto-zooms on focus below 16px
        "bg-secondary placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full rounded-md px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
