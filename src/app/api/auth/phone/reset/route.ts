import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PASSCODE_RE,
  clearLoginAttempts,
  consumeVerifiedSession,
  derivePassword,
  findUserIdByPhone,
  phoneEmail,
} from "@/lib/auth/phone";

const schema = z.object({
  sessionId: z.string().min(1),
  passcode: z.string().regex(PASSCODE_RE),
});

/**
 * Forgot passcode: the user re-verified their phone via verify.mn, so set a
 * new passcode on the account and sign them in.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const { sessionId, passcode } = parsed.data;

  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase) {
    return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  }

  const session = await consumeVerifiedSession(sessionId);
  if (!session.ok) {
    return NextResponse.json({ error: "NOT_VERIFIED" }, { status: 400 });
  }

  const userId = await findUserIdByPhone(session.phone);
  if (!userId) {
    return NextResponse.json({ error: "NOT_REGISTERED" }, { status: 404 });
  }

  const password = derivePassword(passcode);
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  await clearLoginAttempts(session.phone);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: phoneEmail(session.phone),
    password,
  });
  if (signInError) {
    return NextResponse.json({ error: "SIGNIN_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
