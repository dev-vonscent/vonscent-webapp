import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PASSCODE_RE,
  checkLoginAttempts,
  clearLoginAttempts,
  derivePassword,
  isPhoneEmail,
  phoneEmail,
  recordFailedLogin,
} from "@/lib/auth/phone";

const schema = z.object({
  current: z.string().regex(PASSCODE_RE),
  next: z.string().regex(PASSCODE_RE),
});

/**
 * Change the 4-digit passcode from inside the profile. Requires the current
 * passcode (so a stolen open session can't silently take the account over)
 * and rides the same per-phone lockout as login — this is just as much a
 * passcode-guessing surface.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const { current, next } = parsed.data;

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPhoneEmail(user.email)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const phone = user.email!.split("@")[0];

  const gate = await checkLoginAttempts(phone);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "LOCKED", minutes: gate.lockedForMinutes },
      { status: 429 },
    );
  }

  // Verify the current passcode by signing in with it — the only way
  // Supabase lets us check a password. It re-signs the same session.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: phoneEmail(phone),
    password: derivePassword(current),
  });
  if (verifyError) {
    await recordFailedLogin(phone);
    return NextResponse.json({ error: "WRONG_PASSCODE" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "NO_DB" }, { status: 500 });
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: derivePassword(next),
  });
  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  await clearLoginAttempts(phone);
  return NextResponse.json({ ok: true });
}
