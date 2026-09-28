import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * V point-ийн мөнгөн тэмдэг — `₮`, `¥`, `€` шиг үсэг нь хэвтээ зураас
 * дайруулсан глиф. Тоотой зэрэгцүүлж мөрөнд бичихэд зориулав:
 *
 * - өндөр нь `1em`, cap өндөр нь `0.7em` — хажуугийн цифрүүдтэй таарна;
 * - `align-[-0.2em]` нь глифийн суурь шугамыг текстийн baseline дээр буулгана;
 * - өнгө нь `currentColor` — гурван темад тус бүрд тохируулах шаардлагагүй.
 *
 * Зоос хэлбэрийн том тэмдэг (жишээ нь оноогийн картын дүрс) хэрэгтэй бол
 * `VPointIcon`-ыг ашиглана.
 */
export function VPointMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 20"
      fill="currentColor"
      role="img"
      {...props}
      className={cn(
        "inline-block h-[1em] w-[0.8em] align-[-0.2em]",
        className,
      )}
    >
      <title>V point</title>
      {/* cap дээд тал y=2, baseline y=16 — доорх 4 нэгж нь descender зай */}
      <path d="M1 2H6.136V2.878H5.178L8.568 13.133L11.852 2.878H11.176V2H15V2.878H13.261L9.043 16H8.093L2.224 2.878H1Z" />
      <rect x="0.6" y="8.1" width="14.8" height="1.3" />
    </svg>
  );
}
