"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";
import { useWishlist } from "./store";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Keeps the localStorage wishlist and the `wishlists` table in step for
 * signed-in users (todo №22): on sign-in the two lists merge (union — nothing
 * a customer starred is ever dropped), then every toggle is mirrored to the
 * DB so the list follows the account across devices. Guests keep the plain
 * local list. Demo-era slug ids are skipped — the table wants product uuids.
 *
 * Audit fixes: the mirror stays OFF until the merge round-trip has finished
 * (a toggle made mid-merge is folded into the union it snapshots), and auth
 * is observed via onAuthStateChange so sign-out stops mirroring and clears
 * the local list before another account signs in on the same device.
 */
export function WishlistSync() {
  const ids = useWishlist((s) => s.ids);
  const [userId, setUserId] = React.useState<string | null>(null);
  /** Mirroring is armed only after the merge for the CURRENT user finished. */
  const mergedFor = React.useRef<string | null>(null);
  const prev = React.useRef<string[]>([]);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user?.id ?? null;
      setUserId((current) => {
        if (current && !next) {
          // Sign-out: the local list belongs to the account that left.
          mergedFor.current = null;
          useWishlist.setState({ ids: [] });
        }
        return next;
      });
    });
    return () => subscription.unsubscribe();
  }, []);

  // One merge per signed-in user: remote ∪ local, pushed both ways.
  React.useEffect(() => {
    if (!userId || mergedFor.current === userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", userId);
      if (cancelled || error) return; // retry on next render/auth event
      const remote = ((data as { product_id: string }[] | null) ?? []).map(
        (r) => r.product_id,
      );
      // Union against the LIVE local list (not a pre-await snapshot), so a
      // toggle made while the fetch was in flight is preserved.
      const local = useWishlist.getState().ids;
      const union = [...new Set([...local, ...remote])];
      prev.current = union;
      mergedFor.current = userId;
      useWishlist.setState({ ids: union });
      const missing = union.filter(
        (id) => UUID_RE.test(id) && !remote.includes(id),
      );
      if (missing.length) {
        await supabase
          .from("wishlists")
          .upsert(
            missing.map((product_id) => ({ user_id: userId, product_id })),
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Mirror later toggles — armed only once this user's merge completed.
  React.useEffect(() => {
    if (!userId || mergedFor.current !== userId) return;
    const before = prev.current;
    prev.current = ids;
    const added = ids.filter((i) => UUID_RE.test(i) && !before.includes(i));
    const removed = before.filter((i) => UUID_RE.test(i) && !ids.includes(i));
    if (!added.length && !removed.length) return;
    const supabase = createClient();
    if (!supabase) return;
    if (added.length) {
      void supabase
        .from("wishlists")
        .upsert(added.map((product_id) => ({ user_id: userId, product_id })));
    }
    if (removed.length) {
      void supabase
        .from("wishlists")
        .delete()
        .eq("user_id", userId)
        .in("product_id", removed);
    }
  }, [ids, userId]);

  return null;
}
