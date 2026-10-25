"use client";

import type * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { markHomePopupIntent } from "@/features/marketing/home-popup-intent";

/**
 * `mark` — the stacked VON/SCENT emblem (public/brand/von-mark.png, an alpha
 * mask painted in `currentColor` via `.brand-mark`), sized by height only so
 * the 233×240 artwork is never stretched. Without it: the text wordmark used
 * by the auth screens, admin sidebar and menus.
 *
 * Дарж нүүр рүү ороход сурталчилгааны popup гарна (`home-popup-intent`).
 */
export function Logo({
  className,
  mark = false,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { mark?: boolean }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    markHomePopupIntent();
    onClick?.(e);
  };
  if (mark) {
    return (
      <Link
        {...props}
        onClick={handleClick}
        href="/"
        className={cn(
          "text-foreground flex h-10 shrink-0 items-center",
          className,
        )}
        aria-label={`${SITE.name} нүүр хуудас`}
      >
        <span aria-hidden className="brand-mark block aspect-233/240 h-full" />
      </Link>
    );
  }
  return (
    <Link
      {...props}
      onClick={handleClick}
      href="/"
      className={cn(
        "text-foreground font-serif text-xl font-semibold tracking-tight",
        className,
      )}
      aria-label={`${SITE.name} нүүр хуудас`}
    >
      von<span className="text-gold">scent</span>
    </Link>
  );
}
