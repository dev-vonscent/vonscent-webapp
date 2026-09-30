import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Button with a busy state that keeps its size.
 *
 * Swapping the label for «Хадгалж байна…» / «Түр хүлээнэ үү…» resized the
 * button mid-click — dialog footers jumped and full-width rows re-flowed. The
 * label stays in the layout (`invisible`) and a spinner sits on top of it, so
 * the width is exactly what it was before the click.
 */
export const LoadingButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { loading?: boolean }
>(({ loading = false, disabled, className, children, ...props }, ref) => (
  <Button
    ref={ref}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn("relative", className)}
    {...props}
  >
    <span
      className={cn(
        "inline-flex items-center justify-center gap-2",
        loading && "invisible",
      )}
    >
      {children}
    </span>
    {loading && (
      <span className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="animate-spin" aria-hidden />
        <span className="sr-only">Түр хүлээнэ үү</span>
      </span>
    )}
  </Button>
));
LoadingButton.displayName = "LoadingButton";
