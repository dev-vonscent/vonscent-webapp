import { NextResponse, after } from "next/server";
import {
  confirmVerification,
  findSessionByCallbackToken,
} from "@/lib/verify-mn";

/**
 * verify.mn callback (GET, no body, no signature — a wake-up signal only).
 * We re-check the session status upstream before trusting it.
 *
 * Two contract points from the verify.mn docs:
 * - The callback worker only calls from two load-balanced IPs; anything else
 *   gets 403 as they recommend.
 * - It expects a 2xx within 3 seconds, so the 200 goes out first and the
 *   status check runs after the response (`after`).
 */
const CALLBACK_IPS = new Set(["3.34.8.248", "13.124.219.192"]);

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (!CALLBACK_IPS.has(ip)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const token = new URL(req.url).searchParams.get("token");
  if (token) {
    after(async () => {
      try {
        const sessionId = await findSessionByCallbackToken(token);
        if (sessionId) await confirmVerification(sessionId);
      } catch (err) {
        console.error("verify.mn callback status check failed", err);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
