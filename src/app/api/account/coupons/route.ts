import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWallet } from "@/features/account/wallet-server";

/**
 * «Миний купон» — the signed-in customer's own coupons, every status, each with
 * a masked log of who used it (0104). Campaign coupons (`user_id` null) are
 * never listed: they work by code alone.
 */
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ coupons: [] });

  const session = await createClient();
  const { data: { user } = { user: null } } =
    (await session?.auth.getUser()) ?? { data: { user: null } };
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const coupons = await loadWallet(supabase, user.id);
  return NextResponse.json(
    { coupons },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
