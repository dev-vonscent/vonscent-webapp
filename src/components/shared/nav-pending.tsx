"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Per-link "this click registered" feedback.
 *
 * `loading.tsx` covers the wait *after* a navigation commits, but not the gap
 * before it: React holds the current screen while the next route's data is
 * fetched, so on a slow query a tap looks like it did nothing and gets
 * repeated. `useLinkStatus` (Next 15.3+) reports that in-between state, but
 * only from inside the `<Link>` it belongs to — hence a component rather than
 * a hook the sidebar could call.
 *
 * Swapping the row's own icon for a spinner, rather than adding one, keeps the
 * row exactly the same width — an indicator that reflows the nav while you are
 * still moving the pointer is worse than none.
 *
 * Used by the admin sidebar only. The storefront's header and bottom nav were
 * deliberately left plain: those routes are prefetched and their `loading.tsx`
 * skeletons already answer the tap, so a second spinner on the icon read as
 * noise on the screens customers use most.
 */

/**
 * `pending`, but only once it has lasted `delay`.
 *
 * Most navigations here are prefetched and resolve in a few frames; showing a
 * spinner for two frames reads as a flicker, which looks like a glitch rather
 * than progress. Below the threshold the transition stays silent.
 */
function usePendingAfter(delay = 120): boolean {
  const { pending } = useLinkStatus();
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (!pending) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [pending, delay]);

  return show;
}

/**
 * Swaps its children for a spinner while the enclosing link's navigation is in
 * flight.
 *
 * Takes the icon as children rather than as a component prop so each call site
 * keeps whatever it was already passing — the bottom nav varies `strokeWidth`
 * with the active state, and a `icon={Icon}` prop would have quietly dropped
 * it.
 */
export function NavPendingSwap({
  children,
  className = "size-4",
}: {
  children: React.ReactNode;
  /** Sizing for the spinner; should match the icon it replaces. */
  className?: string;
}) {
  const pending = usePendingAfter();
  if (!pending) return <>{children}</>;
  return <Loader2 className={cn("animate-spin", className)} aria-hidden />;
}
