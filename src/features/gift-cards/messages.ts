/**
 * Бэлгийн картын алдааны кодыг хэрэглэгчийн хэлээр (0179 RPC, API route).
 * Client ба server хоёулаа уншина.
 */
export const REDEEM_MESSAGES: Record<string, string> = {
  NOT_FOUND:
    "Ийм код олдсонгүй. Үсэг, тоогоо шалгаад дахин оролдоно уу (жишээ нь VON-7K4P-Q9XM).",
  ALREADY_REDEEMED: "Энэ бэлгийн карт аль хэдийн оноо болсон байна.",
  EXPIRED:
    "Энэ бэлгийн картын хугацаа дууссан байна. Бидэнтэй холбогдвол шалгаж өгье.",
  VOID: "Энэ бэлгийн карт хүчингүй болсон байна.",
  NOT_ACTIVE:
    "Энэ картын төлбөр хараахан баталгаажаагүй байна. Хэсэг хугацааны дараа дахин оролдоно уу.",
  LOGIN_REQUIRED: "Бэлгээ авахын тулд нэвтэрнэ үү.",
  FEATURE_DISABLED: "Бэлгийн карт одоогоор идэвхгүй байна.",
};

export const ORDER_MESSAGES: Record<string, string> = {
  LOGIN_REQUIRED: "Бэлгийн карт худалдаж авахын тулд нэвтэрнэ үү.",
  GIFT_CARD_AMOUNT: "Картын дүнгээ сонгоно уу.",
  GIFT_CARD_DESIGN: "Энэ загвар одоогоор боломжгүй байна. Өөр загвар сонгоно уу.",
  FEATURE_DISABLED: "Бэлгийн карт одоогоор идэвхгүй байна.",
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
  return Object.keys(known).find((code) => message.includes(code)) ?? null;
}
