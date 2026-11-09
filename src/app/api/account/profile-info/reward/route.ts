import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  claimProfileReward,
  profileInfoGate,
} from "@/features/profile-info/server";

export const dynamic = "force-dynamic";

/**
 * Мэдээлэл бүрэн бол нэг удаагийн V point (`claim_profile_reward`, 0163).
 * Нөхцөл, давхардлыг SQL шалгана — энд зөвхөн хэн болохыг дамжуулна.
 */
export async function POST() {
  const gate = await profileInfoGate();
  if ("response" in gate) return gate.response;

  try {
    const points = await claimProfileReward(gate.admin, gate.user.id);
    return NextResponse.json({ points });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "CLAIM_FAILED" }, { status: 500 });
  }
}
