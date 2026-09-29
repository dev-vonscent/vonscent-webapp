import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWallet } from "@/features/account/wallet-server";

const codeSchema = z.string().trim().min(1).max(40);

/**
 * One of the customer's own coupons. Someone else's code — even one they were
 * handed to redeem — is a 404 here: the detail page is the owner's view.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const parsed = codeSchema.safeParse((await params).code);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const session = await createClient();
  const { data: { user } = { user: null } } =
    (await session?.auth.getUser()) ?? { data: { user: null } };
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const [coupon] = await loadWallet(supabase, user.id, parsed.data);
  if (!coupon) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(
    { coupon },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
