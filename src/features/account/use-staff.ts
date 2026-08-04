"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";

/** Roles allowed into /admin — mirrors getStaffUser() and the middleware. */
const STAFF_ROLES = ["operator", "super_admin"];

/**
 * Whether the signed-in user may enter /admin, for showing the admin entry
 * point in the storefront nav. Cosmetic only: the middleware and every route
 * handler re-check the role server-side, so a wrong answer here reveals a link,
 * not data.
 */
export function useIsStaff(): boolean {
  const [isStaff, setIsStaff] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (data as { role?: string } | null)?.role;
      if (!cancelled) setIsStaff(STAFF_ROLES.includes(role ?? ""));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isStaff;
}
