import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ email: z.string().email() });

/**
 * Имэйл бүртгэл — зөвхөн данстай хэрэглэгч (client-ийн шийдвэр). Бүртгэлтэй
 * имэйл рүү захиалгын мэдэгдэл очно; имэйл доторх token линкээр unsubscribe
 * хийнэ (0042_newsletter_accounts.sql).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, demo: true });

  const session = await createClient();
  const {
    data: { user },
  } = (await session?.auth.getUser()) ?? { data: { user: null } };
  if (!user) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const email = parsed.data.email.trim().toLowerCase();
  // An address registered to a DIFFERENT account must not be silently taken
  // over — the upsert below would otherwise reassign its user_id.
  const { data: taken } = await supabase
    .from("newsletter_subscribers")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (
    (taken as { user_id: string | null } | null)?.user_id &&
    (taken as { user_id: string }).user_id !== user.id
  ) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  // One registered email per account: replacing it drops the old row (its
  // token dies with it), and re-registering reactivates an unsubscribed one.
  await supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("user_id", user.id)
    .neq("email", email);
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email, user_id: user.id, is_active: true },
      { onConflict: "email" },
    );
  if (error) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
