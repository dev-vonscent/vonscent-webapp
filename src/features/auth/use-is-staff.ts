"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Is the current browser session an operator/super_admin?
 *
 * Staff-only affordances on ISR-cached public pages (e.g. the review delete
 * button) can't be resolved on the server without making the page dynamic, so
 * the role is read in the browser. The lookup is two round-trips, and a page
 * can render dozens of those affordances at once — so the result is resolved
 * **once per tab** and shared by every caller instead of per component.
 *
 * This only hides UI; every staff action is re-checked server-side.
 */

type Listener = (staff: boolean) => void;

let pending: Promise<boolean> | null = null;
let current: boolean | null = null;
let watching = false;
const listeners = new Set<Listener>();

async function resolveIsStaff(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  return role === "operator" || role === "super_admin";
}

function load(): Promise<boolean> {
  pending ??= resolveIsStaff().then((staff) => {
    current = staff;
    listeners.forEach((notify) => notify(staff));
    return staff;
  });
  return pending;
}

/** Drop the cached role when the session changes, so a logout hides the UI. */
function watchAuth() {
  if (watching) return;
  const supabase = createClient();
  if (!supabase) return;
  watching = true;
  supabase.auth.onAuthStateChange((event) => {
    // INITIAL_SESSION fires on subscribe; re-reading then is a wasted trip.
    if (event === "INITIAL_SESSION") return;
    pending = null;
    current = null;
    void load();
  });
}

export function useIsStaff(): boolean {
  const [staff, setStaff] = React.useState(current ?? false);

  React.useEffect(() => {
    listeners.add(setStaff);
    watchAuth();
    void load().then(setStaff);
    return () => {
      listeners.delete(setStaff);
    };
  }, []);

  return staff;
}
