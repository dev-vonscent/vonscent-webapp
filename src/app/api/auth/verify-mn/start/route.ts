import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { findUserIdByPhone } from "@/lib/auth/phone";
import {
  createVerificationSession,
  isVerifyMnConfigured,
} from "@/lib/verify-mn";

const schema = z.object({
  phone: z.string().regex(/^\d{8}$/u),
  // Session's purpose: lets us refuse doomed flows BEFORE the user pays for
  // an SMS (register on a taken number, reset on an unknown one).
  intent: z.enum(["register", "reset"]).optional(),
});

/**
 * Open a verify.mn MO-SMS session. The client shows `displayInstruction`
 * (Mongolian) and, on mobile, offers `smsUri` as a tap-to-open link; it then
 * polls /api/auth/verify-mn/status until VERIFIED or `expiresAt`.
 */
export async function POST(req: Request) {
  if (!isVerifyMnConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
  }

  if (parsed.data.intent) {
    const registered = Boolean(await findUserIdByPhone(parsed.data.phone));
    if (parsed.data.intent === "register" && registered) {
      return NextResponse.json(
        { error: "ALREADY_REGISTERED" },
        { status: 409 },
      );
    }
    if (parsed.data.intent === "reset" && !registered) {
      return NextResponse.json({ error: "NOT_REGISTERED" }, { status: 404 });
    }
  }

  // Link the session to the signed-in user (if any) so the callback can mark
  // their profile verified.
  let userId: string | undefined;
  const session = await createClient();
  if (session) {
    const {
      data: { user },
    } = await session.auth.getUser();
    userId = user?.id;
  }

  try {
    const s = await createVerificationSession(parsed.data.phone, { userId });
    return NextResponse.json({
      sessionId: s.sessionId,
      smsUri: s.smsUri,
      displayInstruction: s.displayInstruction,
      shortcode: s.shortcode,
      expiresAt: s.expiresAt,
    });
  } catch (err) {
    console.error("verify.mn session create failed", err);
    return NextResponse.json({ error: "SESSION_FAILED" }, { status: 502 });
  }
}
