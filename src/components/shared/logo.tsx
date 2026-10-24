import type * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";

/**
 * `mark` — the stacked VON/SCENT emblem (public/brand/von-mark.png, an alpha
 * mask painted in `currentColor` via `.brand-mark`), sized by height only so
 * the 233×240 artwork is never stretched. Without it: the text wordmark used
 * by the auth screens, admin sidebar and menus.
 */
export function Logo({
  className,
  mark = false,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { mark?: boolean }) {
  if (mark) {
    return (
      <Link
        {...props}
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
