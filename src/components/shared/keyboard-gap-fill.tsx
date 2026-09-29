"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Гар «нээлттэй» гэж үзэх доод босго — toolbar-ын хэлбэлзлийг тоохгүй. */
const KEYBOARD_MIN_PX = 120;

/**
 * Гар нээлттэй үед харагдах хэсгийн доорх зурвасыг bottom sheet-ийн өнгөөр
 * дүүргэнэ.
 *
 * iOS 26 гарын toolbar (˄ ˅ ✓) болон URL pill-ийг visual viewport-ын ГАДНА,
 * хагас тунгалаг хөвүүлдэг. Тэр зурвасыг fixed давхаргуудын compositing-оос
 * гадуур зурдаг тул `position: fixed` юу ч (sheet, overlay, pseudo-element,
 * 99% opacity) тэнд хүрдэггүй — sheet гарын дээр тасарч, завсраар нь
 * бараандаагүй хуудас харагддаг байв. Тэнд зурагддаг цорын ганц зүйл бол
 * хуудасны энгийн урсгал.
 *
 * Тиймээс энэ элемент fixed БИШ: `<body>` (relative) дотор `absolute`-аар,
 * баримтын координатаар харагдах хэсгийн яг доод ирмэгт байрлана. Sheet-ийн
 * ард (z-40 < z-50) хэдэн px давхцаж, доошоо гарын ард үргэлжилнэ. Sheet нээлттэй
 * үед хуудас scroll-lock-той тул байрлал нь хөдлөхгүй.
 */
export function KeyboardGapFill({ className }: { className?: string }) {
  const [top, setTop] = React.useState<number | null>(null);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboardOpen = window.innerHeight - vv.height > KEYBOARD_MIN_PX;
      setTop(
        keyboardOpen
          ? Math.round(window.scrollY + vv.offsetTop + vv.height) - 4
          : null,
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  if (top === null) return null;
  return createPortal(
    <div
      aria-hidden
      className={cn(
        "bg-card pointer-events-none absolute inset-x-0 z-40 h-screen",
        className,
      )}
      style={{ top }}
    />,
    document.body,
  );
}
