import { NextResponse } from "next/server";
import { giftCardRedeemSchema } from "@/lib/validators/gift-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { enforceRateLimit } from "@/lib/rate-limit";
import { REDEEM_MESSAGES, knownErrorCode } from "@/features/gift-cards/messages";

interface RedeemResult {
  ok: boolean;
  reason?: string;
  amount?: number;
  points?: number;
}

/**
 * POST /api/gift-cards/redeem — кодыг V point болгох (gift-cards-plan §4.5).
 *
 * Нэвтрэлт заавал (K8). Rate limit хоёр тэнхлэгтэй: хэрэглэгчээр (таах
 * оролдлого) ба IP-ээр (олон бүртгэлээр ээлжлэх). Амжилттай оролдлого ч
 * тоологдоно — жинхэнэ хүн 1–2 удаа л дарна.
 */
export async function POST(req: Request) {
  if (!(await isFeatureEnabled("gift_cards"))) {
    return NextResponse.json({ error: "FEATURE_DISABLED" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = giftCardRedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const sessionClient = await createClient();
  const {
    data: { user },
  } = sessionClient
    ? await sessionClient.auth.getUser()
    : { data: { user: null } };
  if (!user) {
    return NextResponse.json(
      { error: "LOGIN_REQUIRED", message: REDEEM_MESSAGES.LOGIN_REQUIRED },
      { status: 401 },
    );
  }

  const byIp = await enforceRateLimit("giftCardRedeemIp", req);
  if (byIp) return byIp;
  const byUser = await enforceRateLimit("giftCardRedeem", req, {
    subject: user.id,
    subjectKind: "user",
  });
  if (byUser) return byUser;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "REDEEM_FAILED" }, { status: 503 });
  }
  const args = {
    p_user: user.id,
    p_code: parsed.data.code ?? null,
    p_token: parsed.data.token ?? null,
  };
  let { data, error } = await callRpc<RedeemResult>(supabase, "redeem_gift_card", args);
  // Хоёр хүн бие биеийнхээ авсан картыг яг зэрэг оруулбал profile-ийн
  // түгжээ эсрэг дараалалд орж Postgres нэгийг нь цуцалж болно (40P01).
  // Оноо давхардахгүй (транзакц бүтнээрээ буцсан) — нэг удаа дахин.
  if (error && /deadlock/iu.test(error.message)) {
    ({ data, error } = await callRpc<RedeemResult>(supabase, "redeem_gift_card", args));
  }
  if (error || !data) {
    const code = knownErrorCode(error?.message, REDEEM_MESSAGES);
    if (code) {
      return NextResponse.json(
        { error: code, message: REDEEM_MESSAGES[code] },
        { status: code === "FEATURE_DISABLED" ? 404 : 409 },
      );
    }
    return NextResponse.json({ error: "REDEEM_FAILED" }, { status: 500 });
  }
  if (!data.ok) {
    const reason = data.reason ?? "NOT_FOUND";
    return NextResponse.json(
      { error: reason, message: REDEEM_MESSAGES[reason] ?? REDEEM_MESSAGES.NOT_FOUND },
      { status: reason === "NOT_FOUND" ? 404 : 409 },
    );
  }
  return NextResponse.json({ ok: true, amount: data.amount, points: data.points });
}
