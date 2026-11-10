import { NextResponse } from "next/server";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resendGiftCard } from "@/features/gift-cards/email";

const bodySchema = z.object({
  email: z.string().trim().email("Имэйл хаяг буруу байна.").max(254),
});

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "Карт олдсонгүй.",
  NOT_ACTIVE: "Энэ картыг илгээх боломжгүй (оноо болсон эсвэл хугацаа дууссан).",
  TOO_MANY: "Энэ картыг хэт олон удаа илгээсэн байна. Бидэнтэй холбогдоно уу.",
  SEND_FAILED: "Имэйл илгээж чадсангүй. Хэсэг хугацааны дараа дахин оролдоно уу.",
};

/**
 * POST /api/gift-cards/cards/<id>/send — худалдан авагч картаа имэйлээр
 * илгээх, дахин илгээх, буруу бичсэн хаягаа засах (gift-cards-plan §2.2).
 * Эрх: зөвхөн картын худалдан авагч, ашиглагдаагүй карт.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isFeatureEnabled("gift_cards"))) {
    return NextResponse.json({ error: "FEATURE_DISABLED" }, { status: 404 });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: "Имэйл хаяг буруу байна." },
      { status: 400 },
    );
  }

  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }
  const limited = await enforceRateLimit("giftCardSend", req, {
    subject: user.id,
    subjectKind: "user",
  });
  if (limited) return limited;

  const result = await resendGiftCard({
    cardId: id,
    email: parsed.data.email,
    buyerId: user.id,
    actor: user.id,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: result.error === "NOT_FOUND" ? 404 : 409 },
    );
  }
  return NextResponse.json({ ok: true, email: result.email });
}
