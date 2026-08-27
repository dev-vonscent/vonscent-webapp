"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { KeyboardInset } from "@/components/shared/keyboard-inset";
import { cn } from "@/lib/utils";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 640px)").matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * Desktop дээр төвийн Dialog, мобайл (< sm) дээр grab handle-тай bottom
 * sheet болдог нэг wrapper. Sheet нь дэлгэцийн гар гарахад `--kb-inset`-ээр
 * дээшилнэ (KeyboardInset).
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn("max-h-[85dvh] overflow-y-auto", className)}
          aria-describedby={description ? undefined : ""}
        >
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t-0 pt-3 pb-[calc(var(--kb-inset,0px)+max(env(safe-area-inset-bottom),1.5rem))]",
          className,
        )}
        aria-describedby={description ? undefined : ""}
      >
        <KeyboardInset />
        <div
          aria-hidden
          className="bg-muted-foreground/40 mx-auto h-1 w-10 shrink-0 rounded-full"
        />
        <SheetTitle>{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
        {children}
      </SheetContent>
    </Sheet>
  );
}
