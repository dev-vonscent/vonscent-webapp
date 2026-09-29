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
        // доод ирмэгт бэхэлнэ (`--vv-bottom`, KeyboardInset); өндөр нь
        // харагдах хэсэгтээ бүрэн багтана.
        //
        // Доошоо «үргэлжилдэг» байх ёстой: iOS 26 гарын toolbar, URL pill нь
        // хагас тунгалаг бөгөөд viewport-ын ГАДНА хөвдөг — ард нь хуудас
        // зурагдана. Хоёр засвар:
        //  • `after:` — sheet-ийн өнгөт хэсэг доод ирмэгээсээ цааш 50vh
        //    үргэлжилж, тэр завсрыг дүүргэнэ (native sheet шиг гарын ард
        //    үргэлжилнэ).
        //  • `/99` — Safari 26 бүрэн opaque fixed давхаргыг хөвөгч мөрний
        //    хэсэгт тайрдаг; 99% тунгалаг давхаргыг бүтэн зурдаг (WebKit
        //    алдаа). Зөвхөн гадна давхарга /99 — агуулга нь дотроо бүрэн
        //    `bg-card` тул ард нь юу ч тусахгүй.
        // Overlay нь мөн адил доошоо сунана.
        overlayClassName="-bottom-[50vh]"
        className={cn(
          "bg-card/99 after:bg-card/99 max-h-[min(85dvh,calc(var(--vv-height,100dvh)-0.5rem))] rounded-t-3xl border-t-0 p-0 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[50vh]",
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
        {/* Бүх агуулга нэг бүрэн opaque давхарга дотор — гадна /99 давхаргын
            ард юу ч тусахгүй. Толгой гүйдэггүй: агуулга багтахгүй үед зөвхөн
            доорх хэсэг гүйж, гарчиг ямагт харагдана. `gap`-ийг sheet-ээс
            удамшуулна — дуудагч `className="gap-3"` өгвөл урьдын адил. */}
        <div className="bg-card flex min-h-0 flex-1 flex-col gap-[inherit] rounded-t-3xl pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <div className="flex shrink-0 flex-col gap-[inherit] px-6">
            <div
              aria-hidden
              className="bg-muted-foreground/40 mx-auto h-1 w-10 shrink-0 rounded-full"
            />
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[inherit] overflow-y-auto overscroll-contain px-6 pb-1">
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
