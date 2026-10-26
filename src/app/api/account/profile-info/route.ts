import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { profileInfoPatchSchema } from "@/lib/validators/profile-info";
import {
  getProfileInfo,
  profileInfoGate,
  updateProfileInfo,
} from "@/features/profile-info/server";

export const dynamic = "force-dynamic";

/** Нэвтэрсэн хэрэглэгчийн «Миний мэдээлэл» (0163, feature flag `profile_info`). */
export async function GET() {
  const gate = await profileInfoGate();
  if ("response" in gate) return gate.response;

  try {
    const info = await getProfileInfo(gate.admin, gate.user.id);
    return NextResponse.json(info, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "PROFILE_INFO_FAILED" }, { status: 500 });
  }
}

/** Нэг (эсвэл хэд хэдэн) талбарыг хадгална — зөвхөн өөрийн мөр. */
export async function PATCH(req: Request) {
  // Хаалга эхэнд: туг хаалттай бол body ямар ч байсан 404.
  const gate = await profileInfoGate();
  if ("response" in gate) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = profileInfoPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  try {
    const result = await updateProfileInfo(
      gate.admin,
      gate.user.id,
      parsed.data,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
