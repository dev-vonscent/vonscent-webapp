import { NextResponse } from "next/server";
import { z } from "zod";
import { callRpc } from "@/lib/supabase/rpc";
import { giftCardExtendSchema } from "@/lib/validators/gift-card";
import { giftCardsAdminGate } from "@/features/gift-cards/admin-api";

const MESSAGES: Record<string, string> = {
  GIFT_CARD_EXTEND_DATE: "Өнөөдрөөс хойш 2 жилийн дотор өдөр сонгоно уу.",
  GIFT_CARD_NOT_EXTENDABLE: "Ашиглаагүй эсвэл хугацаа дууссан картыг л сунгана.",
  REASON_REQUIRED: "Шалтгаанаа бичнэ үү.",
  NOT_FOUND: "Карт олдсонгүй.",
};

/**
 * Админ: хугацаа сунгах (gift-cards-plan §12-Q8) — мөнгөтэй холбоотой тул
 * зөвхөн super_admin. Шинэ хугацаа = сонгосон өдрийн 23:59:59 (УБ).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await giftCardsAdminGate({ superAdmin: true });
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const parsed = giftCardExtendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }
  const { data, error } = await callRpc<{ ok: boolean; expires_at: string }>(
    gate.supabase,
    "admin_extend_gift_card",
    {
      p_card: id,
      p_until: `${parsed.data.until}T23:59:59+08:00`,
      p_by: gate.staff.id,
      p_reason: parsed.data.reason,
    },
  );
  if (error || !data) {
    const code = Object.keys(MESSAGES).find((k) => error?.message.includes(k));
    return NextResponse.json(
      { error: code ? MESSAGES[code] : "Сунгахад алдаа гарлаа." },
      { status: code ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, expiresAt: data.expires_at });
}
