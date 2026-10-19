import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getTierSummary, tierUserGate } from "@/features/tiers/server";

export const dynamic = "force-dynamic";

/**
 * Нэвтэрсэн хэрэглэгчийн түвшин, нийт худалдан авалт, 7 хоног/сарын топ
 * (0138, feature flag `user_tiers`). Бусдын бүтэн нэр хариунд орохгүй.
 */
export async function GET() {
  const gate = await tierUserGate();
  if ("response" in gate) return gate.response;

  try {
    const summary = await getTierSummary(gate.admin, gate.user.id);
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "TIER_FAILED" }, { status: 500 });
  }
}
