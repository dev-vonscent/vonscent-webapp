import "server-only";
import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

/** `/api/admin/vials/*` — туг `vial_inventory` → staff → service client. */
export async function vialAdminGate() {
  if (!(await isFeatureEnabled("vial_inventory"))) {
    return {
      error: NextResponse.json({ error: "Олдсонгүй." }, { status: 404 }),
    } as const;
  }
  const staff = await getStaffUser();
  if (!staff) {
    return {
      error: NextResponse.json({ error: "Эрх хүрэхгүй." }, { status: 403 }),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return { error: NextResponse.json({ demo: true }) } as const;
  }
  return { staff, supabase } as const;
}
