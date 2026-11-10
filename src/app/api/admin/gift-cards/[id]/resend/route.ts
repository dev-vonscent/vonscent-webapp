import { NextResponse } from "next/server";
import { z } from "zod";
import { giftCardResendSchema } from "@/lib/validators/gift-card";
import { giftCardsAdminGate } from "@/features/gift-cards/admin-api";
import { resendGiftCard } from "@/features/gift-cards/email";

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "Карт олдсонгүй.",
  NOT_ACTIVE: "Ашиглагдаагүй картыг л илгээнэ.",
  TOO_MANY: "Энэ картыг хэт олон удаа илгээсэн байна.",
  TOO_SOON: "Саяхан илгээсэн байна. 5 минутын дараа дахин оролдоно уу.",
  SEND_FAILED: "Имэйл илгээж чадсангүй (Resend). Дахин оролдоно уу.",
};

/** Админ: картыг (өөр) имэйл рүү дахин илгээх. Ажилтан бүр. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await giftCardsAdminGate();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const parsed = giftCardResendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Имэйл хаяг буруу байна." }, { status: 400 });
  }
  const result = await resendGiftCard({
    cardId: id,
    email: parsed.data.email,
    buyerId: null,
    actor: gate.staff.id,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: MESSAGES[result.error] },
      { status: result.error === "NOT_FOUND" ? 404 : 409 },
    );
  }
  return NextResponse.json({ ok: true, email: result.email });
}
