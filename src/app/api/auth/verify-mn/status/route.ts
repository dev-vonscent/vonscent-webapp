import { NextResponse } from "next/server";
import {
  getVerificationStatus,
  recordVerificationStatus,
} from "@/lib/verify-mn";

/**
 * Poll endpoint for the client while it waits for the user's SMS. Clients
 * must poll no faster than every 3s — verify.mn 429s the same session when
 * queried more often than every 2s.
 */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 });
  }

  try {
    const status = await getVerificationStatus(sessionId);
    if (!status) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (status.sessionStatus === "VERIFIED") {
      // Record it (session row + profile) without re-fetching the status —
      // a second immediate GET for the same session would 429.
      await recordVerificationStatus(status);
    }
    return NextResponse.json({
      sessionStatus: status.sessionStatus,
      expiresAt: status.expiresAt,
    });
  } catch (err) {
    console.error("verify.mn status check failed", err);
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 502 });
  }
}
