import { NextResponse } from "next/server";
import { z } from "zod";
import { getWheelState, spinWheel } from "@/features/lucky-wheel/api";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Азын хүрд (docs/lucky-wheel.md).
 *
 *   GET  /api/lucky-wheel   → the segments, the customer's balance, cooldown
 *   POST /api/lucky-wheel   → one spin  { mode: "free" | "order" | "points" }
 *
 * Never cached: the answer depends on the session cookie and on a cooldown
 * measured in seconds.
 */
export const dynamic = "force-dynamic";

const spinSchema = z.object({
  mode: z.enum(["free", "order", "points"]),
});

// Туг хаалттай үед хүрд байхгүй мэт — UI нуусан ч API шууд дуудагдана.
const notFound = () =>
  NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

export async function GET() {
  if (!(await isFeatureEnabled("lucky_wheel"))) return notFound();
  return NextResponse.json(await getWheelState());
}

export async function POST(req: Request) {
  if (!(await isFeatureEnabled("lucky_wheel"))) return notFound();
  const body = await req.json().catch(() => null);
  const parsed = spinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "INVALID" }, { status: 400 });
  }

  const result = await spinWheel(parsed.data.mode);
  if (!result.ok) {
    // A refusal is a legitimate answer here (cooldown, too few points), so the
    // status mirrors *why* rather than always shouting 500: the client shows a
    // different message for each, and only AUTH sends the customer to /login.
    const status =
      result.reason === "AUTH" ? 401 : result.reason === "NO_DB" ? 500 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
