import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PASSCODE_RE,
  consumeVerifiedSession,
  derivePassword,
  findUserIdByPhone,
  phoneEmail,
} from "@/lib/auth/phone";

const schema = z.object({
  sessionId: z.string().min(1),
  passcode: z.string().regex(PASSCODE_RE),
  fullName: z.string().max(120).optional(),
});

/**
 * Create a phone account after a verify.mn session went VERIFIED: consume
 * the session, create the Supabase user under the synthetic email, then sign
 * the browser in (cookies set by the server client).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const { sessionId, passcode, fullName } = parsed.data;

  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase) {
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  }

  const session = await consumeVerifiedSession(sessionId);
  if (!session.ok) {
    return NextResponse.json({ error: "NOT_VERIFIED" }, { status: 400 });
  }

  if (await findUserIdByPhone(session.phone)) {
    return NextResponse.json({ error: "ALREADY_REGISTERED" }, { status: 409 });
  }

  const password = derivePassword(passcode);
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: phoneEmail(session.phone),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? "" },
    });
  if (createError || !created.user) {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }

  // handle_new_user() made the profile row; stamp the verified phone on it.
  await admin
    .from("profiles")
    .update({ phone: session.phone, phone_verified: true })
    .eq("id", created.user.id);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: phoneEmail(session.phone),
    password,
  });
  if (signInError) {
    return NextResponse.json({ error: "SIGNIN_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
