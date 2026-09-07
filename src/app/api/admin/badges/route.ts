import { NextResponse } from "next/server";
import { getSidebarBadges, type SidebarBadges } from "@/features/admin/api";
import { getStaffUser } from "@/lib/auth/guard";

/**
 * Sidebar counts (шинэ захиалга / дууссан бараа).
 *
 * These used to be awaited inside `(admin)/layout.tsx`. The layout re-renders
 * on every admin navigation, so two round trips to Supabase — ~200-350ms from
 * here — sat in front of *every* sidebar click, before the target route's
 * `loading.tsx` could even be shown. Moving them to their own request takes
 * them off that path: the page swaps immediately and the numbers arrive when
 * they arrive.
 */
export const dynamic = "force-dynamic";

const EMPTY: SidebarBadges = { newOrders: 0, outOfStock: 0 };

export async function GET() {
  const staff = await getStaffUser();
  // Not staff (or no Supabase): zeros, not an error — the sidebar renders
  // fine without counts and this is decoration, not data.
  if (!staff) return NextResponse.json(EMPTY);
  return NextResponse.json(await getSidebarBadges());
}
