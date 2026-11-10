/**
 * Бэлгийн картын алдааны кодыг хэрэглэгчийн хэлээр (0179 RPC, API route).
 * Client ба server хоёулаа уншина.
 */
export const REDEEM_MESSAGES: Record<string, string> = {
  NOT_FOUND:
    "Ийм код олдсонгүй. Үсэг, тоогоо шалгаад дахин оролдоно уу (жишээ нь VON-7K4P-Q9XM).",
  ALREADY_REDEEMED: "Энэ бэлгийн карт аль хэдийн оноо болсон байна.",
  EXPIRED:
    "Энэ бэлгийн картын хугацаа дууссан байна (төлбөрөөс хойш 1 жилийн дотор оноо болгох ёстой).",
  VOID: "Энэ бэлгийн карт хүчингүй болсон байна.",
  NOT_ACTIVE:
    "Энэ картын төлбөр хараахан баталгаажаагүй байна. Хэсэг хугацааны дараа дахин оролдоно уу.",
  LOGIN_REQUIRED: "Бэлгээ авахын тулд нэвтэрнэ үү.",
  FEATURE_DISABLED: "Бэлгийн карт одоогоор идэвхгүй байна.",
  AUTH_REQUIRED: "Бэлгээ авахын тулд нэвтэрнэ үү.",
  OWN_CARD:
    "Энэ картыг та өөрөө худалдаж авсан. Оноо таны дансанд орж, карт өөр хүнд ашиглагдахгүй болно.",
};

export const ORDER_MESSAGES: Record<string, string> = {
  LOGIN_REQUIRED: "Бэлгийн карт худалдаж авахын тулд нэвтэрнэ үү.",
  GIFT_CARD_AMOUNT: "Картын дүнгээ сонгоно уу.",
  GIFT_CARD_DESIGN: "Энэ загвар одоогоор боломжгүй байна. Өөр загвар сонгоно уу.",
  FEATURE_DISABLED: "Бэлгийн карт одоогоор идэвхгүй байна.",
  AUTH_REQUIRED: "Бэлгийн карт худалдаж авахын тулд нэвтэрнэ үү.",
  GIFT_CARD_SEND_AT_NEEDS_EMAIL:
    "Тодорхой өдөр илгээхийн тулд хүлээн авагчийн имэйлийг бичнэ үү.",
  GIFT_CARD_SEND_AT: "Илгээх өдрийг 300 хоногийн дотор сонгоно уу.",
  ORDER_PENDING:
    "Захиалга тань үүсч байна. Хэсэг хүлээгээд «Миний бэлгийн карт» хэсгээс шалгаарай.",
};

export const GENERIC_ERROR = "Алдаа гарлаа. Дахин оролдоно уу.";

/** RPC-ийн `raise exception 'CODE'` мессежээс мэдэгдэх кодыг олно. */
export function knownErrorCode(
  message: string | undefined,
  known: Record<string, string>,
): string | null {
  if (!message) return null;
  // Урт нь эхэнд: `GIFT_CARD_SEND_AT_NEEDS_EMAIL` нь `GIFT_CARD_SEND_AT`-ийг
  // агуулдаг — богино нь түрүүлж таарахгүй.
  return (
    Object.keys(known)
      .sort((a, b) => b.length - a.length)
      .find((code) => message.includes(code)) ?? null
  );
}
