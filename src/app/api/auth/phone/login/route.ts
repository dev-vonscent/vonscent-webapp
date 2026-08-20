import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  PASSCODE_RE,
  checkLoginAttempts,
  clearLoginAttempts,
  derivePassword,
  phoneEmail,
  recordFailedLogin,
} from "@/lib/auth/phone";

const schema = z.object({
  phone: z.string().regex(/^\d{8}$/u),
  passcode: z.string().regex(PASSCODE_RE),
});

/**
 * Phone + passcode sign-in. A 4-digit passcode is brute-forceable, so wrong
 * attempts are counted per phone and the phone locks for 15 minutes after 5
 * misses — this route is the only path that can try passcodes (the real
 * Supabase password is peppered server-side).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const { phone, passcode } = parsed.data;

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const gate = await checkLoginAttempts(phone);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "LOCKED", minutes: gate.lockedForMinutes },
      { status: 429 },
    );
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: phoneEmail(phone),
    password: derivePassword(passcode),
  });
  if (error) {
    await recordFailedLogin(phone);
    return NextResponse.json({ error: "WRONG_CREDENTIALS" }, { status: 401 });
  }

  await clearLoginAttempts(phone);
  return NextResponse.json({ ok: true });
}
