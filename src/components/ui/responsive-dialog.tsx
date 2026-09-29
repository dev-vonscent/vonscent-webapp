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
import { KeyboardGapFill } from "@/components/shared/keyboard-gap-fill";
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
 * sheet болдог нэг wrapper. Гар гарахад sheet нь харагдах хэсгийн доод
 * ирмэгт бэхлэгдэнэ (`--vv-bottom`, KeyboardInset).
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
        // Гар нээлттэй үед sheet-ийг layout viewport биш, ХАРАГДАЖ БУЙ хэсгийн
        // доод ирмэгт бэхэлнэ (`--vv-bottom`, KeyboardInset) — гарын яг дээр
        // зогсоно. Өндөр нь харагдах хэсэгтээ бүрэн багтана. Доорх iOS
        // toolbar-ын зурвасыг `KeyboardGapFill` дүүргэнэ.
        overlayClassName="bottom-[min(0px,var(--vv-bottom,0px))]"
        className={cn(
          "max-h-[min(85dvh,calc(var(--vv-height,100dvh)-0.5rem))] rounded-t-3xl border-t-0 px-0 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]",
          className,
        )}
        // Inline: `side="bottom"`-ийн `bottom-0`-той tailwind-merge нийлүүлдэггүй.
        style={{ bottom: "var(--vv-bottom, 0px)" }}
        aria-describedby={description ? undefined : ""}
        // Утсан дээр эхний input руу автоматаар focus хийхгүй: гар шууд
        // гарч sheet-ийн талыг таглаад, хэрэглэгч юу бөглөхөө харахаас өмнө
        // бичих горимд оруулдаг байв. Focus-ыг sheet өөр дээрээ (tabIndex=-1)
        // авч үлдэнэ — focus trap, Esc, screen reader хэвээр; гар нь input
        // дээр дарахад л гарна.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <KeyboardInset />
        <KeyboardGapFill />
        {/* Толгой гүйдэггүй: агуулга багтахгүй үед зөвхөн доорх хэсэг гүйж,
            гарчиг ямагт харагдана. Хоёулаа sheet-ийн `gap`-ийг удамшуулна —
            дуудагч `className="gap-3"` өгвөл урьдын адил бүх мөрөнд үйлчилнэ. */}
        <div className="flex shrink-0 flex-col px-6 gap-[inherit]">
          <div
            aria-hidden
            className="bg-muted-foreground/40 mx-auto h-1 w-10 shrink-0 rounded-full"
          />
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-1 gap-[inherit]">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
