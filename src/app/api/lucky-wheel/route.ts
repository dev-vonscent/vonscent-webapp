import { NextResponse } from "next/server";
import { z } from "zod";
import { getWheelState, spinWheel } from "@/features/lucky-wheel/api";

/**
 * Азын хүрд (docs/lucky-wheel.md).
 *
 *   GET  /api/lucky-wheel   → the segments, the customer's balance, cooldown
 *   POST /api/lucky-wheel   → one spin  { mode: "free" | "points" }
 *
 * Never cached: the answer depends on the session cookie and on a cooldown
 * measured in seconds.
 */
export const dynamic = "force-dynamic";

const spinSchema = z.object({
  mode: z.enum(["free", "points"]),
});

export async function GET() {
  return NextResponse.json(await getWheelState());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = spinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "INVALID" }, { status: 400 });
  }

  const result = await spinWheel(parsed.data.mode === "points");
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
