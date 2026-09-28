import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * V point-ийн тэмдэг: дугуй зоос дотор өндөр contrast-тай serif V.
 *
 * Дугуй нь `currentColor`-оор будагдаж, V болон нарийн хүрээ нь **цоолсон**
 * (fill-rule="evenodd") — өөрөөр хэлбэл ард нь байгаа гадаргуугийн өнгө
 * шууд харагдана. Тиймээс black/white/pink гурван темад тус бүрд өнгө
 * тохируулах шаардлагагүй: өнгийг `text-*` классаар л өгнө
 * (ж: `text-gold`, `text-foreground`).
 *
 * `public/v-point.svg` нь үүнтэй ижил дүрстэй боловч өнгөө өөртөө агуулсан
 * хувилбар — зөвхөн апп-аас гадна (и-мэйл, OG зураг) хэрэглэнэ.
 */
export function VPointIcon({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
      {...props}
      className={cn("size-6", className)}
    >
      <path
        d="M0 16A16 16 0 1 0 32 16A16 16 0 1 0 0 16Z
           M2.2 16A13.8 13.8 0 1 0 29.8 16A13.8 13.8 0 1 0 2.2 16Z
           M2.95 16A13.05 13.05 0 1 0 29.05 16A13.05 13.05 0 1 0 2.95 16Z
           M6.6 10.06H12.98V10.92H11.79L16 20.97L20.08 10.92H19.24V10.06H23.99V10.92H21.83L16.59 23.78H15.41L8.12 10.92H6.6Z"
      />
    </svg>
  );
}
