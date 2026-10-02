"use client";

import { useProfileSummary } from "@/features/account/use-profile-summary";

/**
 * Whether the signed-in user may enter /admin, for showing the admin entry
 * point in the storefront nav. Cosmetic only: the middleware and every route
 * handler re-check the role server-side, so a wrong answer here reveals a link,
 * not data.
 *
 * Read from the shared header profile query (`useProfileSummary`) rather than
 * its own `getUser()` + `profiles` round trip on every mount.
 */
export function useIsStaff(): boolean {
  return useProfileSummary().profile?.isStaff ?? false;
}
