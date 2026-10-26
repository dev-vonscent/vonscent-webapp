import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  chooseGrandBundle,
  getGrandPrizesResponse,
} from "@/features/lucky-wheel/prizes";

/**
 * Азын хүрдний гранд шагнал (0165, feature flag `lucky_wheel`).
 *
 *   GET  → миний гранд шагналууд + санал болгож буй 2 багц
 *   POST → багц сонгох/солих  { spinId, gender: "male" | "female" }
 */
export const dynamic = "force-dynamic";

const chooseSchema = z.object({
  spinId: z.string().uuid(),
  gender: z.enum(["male", "female"]),
});

async function gate() {
  if (!(await isFeatureEnabled("lucky_wheel"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 503 }),
    } as const;
  }
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  if (!user) {
    return {
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    } as const;
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { admin, userId: user.id } as const;
}

export async function GET() {
  const g = await gate();
  if ("response" in g) return g.response;
  try {
    return NextResponse.json(await getGrandPrizesResponse(g.admin, g.userId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "PRIZES_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const g = await gate();
  if ("response" in g) return g.response;
  const parsed = chooseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  try {
    const result = await chooseGrandBundle(
      g.admin,
      g.userId,
      parsed.data.spinId,
      parsed.data.gender,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason },
        { status: result.reason === "NOT_FOUND" ? 404 : 409 },
      );
    }
    return NextResponse.json(await getGrandPrizesResponse(g.admin, g.userId));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "CHOOSE_FAILED" }, { status: 500 });
  }
}
