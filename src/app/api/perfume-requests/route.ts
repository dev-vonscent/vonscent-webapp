import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { perfumeRequestInputSchema } from "@/lib/validators/perfume-request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { callRpc } from "@/lib/supabase/rpc";
import {
  getActiveConcentrations,
  resolveBrandId,
  resolveConcentration,
} from "@/features/taxonomy/api";
import { perfumeRequestUserGate } from "@/features/perfume-requests/server";
import type { SubmitPerfumeRequestResponse } from "@/features/perfume-requests/types";

export const dynamic = "force-dynamic";

interface SubmitResult {
  requestId: string;
  isNew: boolean;
  isNewVote: boolean;
  voteCount: number;
}

/**
 * Шинэ үнэртний санал илгээх (0137, feature flag `perfume_requests`).
 * Ижил үнэртэн өмнө нь байвал «+1». Нэвтэрсэн хэрэглэгч л; хариу, мэдэгдэл
 * байхгүй — админ жагсаалтаас харна (клиент, 2026-10-15).
 */
export async function POST(req: Request) {
  const gate = await perfumeRequestUserGate();
  if ("response" in gate) return gate.response;

  const parsed = perfumeRequestInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const limited = await enforceRateLimit("perfumeRequest", req, {
    subject: gate.user.id,
  });
  if (limited) return limited;

  // Концентраци нь админы идэвхтэй жагсаалтын (0085) код байх ёстой — гараар
  // бичсэн утга орохгүй. Брэнд нь жагсаалтад байвал холбоно, эс бөгөөс
  // чөлөөт текст хэвээр.
  let concentration: string | null = null;
  if (input.concentration) {
    const [code, active] = await Promise.all([
      resolveConcentration(input.concentration),
      getActiveConcentrations(),
    ]);
    concentration = active.some((c) => c.code === code) ? code : null;
    if (!concentration) {
      return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    }
  }
  const brandId = await resolveBrandId(input.brand);

  const { data, error } = await callRpc<SubmitResult | null>(
    gate.admin,
    "submit_perfume_request",
    {
      p_user: gate.user.id,
      p_brand: input.brand,
      p_name: input.name,
      p_concentration: concentration,
      p_note: input.note || null,
      p_brand_id: brandId,
    },
  );
  if (error) {
    if (error.message.includes("INVALID_INPUT")) {
      return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    }
    Sentry.captureException(
      new Error(`submit_perfume_request: ${error.message}`),
    );
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
  // null = туг SQL талд хаалттай (кэш хоцорсон) — route байхгүй мэт.
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    alreadyRequested: !data.isNewVote,
  } satisfies SubmitPerfumeRequestResponse);
}
