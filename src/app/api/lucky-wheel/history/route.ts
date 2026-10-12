import { NextResponse } from "next/server";
import { z } from "zod";
import { getSpinHistory } from "@/features/lucky-wheel/api";

/**
 * The signed-in customer's full spin history, a page at a time — the wheel
 * page itself only carries the latest five.
 *
 *   GET /api/lucky-wheel/history?offset=0
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export async function GET(req: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const page = await getSpinHistory(parsed.data.offset);
  if (!page) {
    return NextResponse.json({ error: "AUTH" }, { status: 401 });
  }
  return NextResponse.json(page);
}
