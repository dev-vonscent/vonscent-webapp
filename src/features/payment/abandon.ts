/**
 * Төлөгдөөгүй захиалгыг орхих — «Дараа захиалах» / «Устгах» (0124).
 * Төлбөрийн хуудас ба «Миний захиалга»-ын дэлгэрэнгүй хоёулаа үүгээр явна.
 *
 * `paid` — сервер цуцлахаасаа өмнө QPay-ээс асуухад мөнгө орсон байсан;
 * захиалга цуцлагдаагүй, дуудагч төлөгдсөн төлөвийг харуулна.
 */
export type AbandonResult =
  | { ok: true }
  | { ok: false; paid: true }
  | { ok: false; paid?: false; message: string };

export async function requestAbandon(
  token: string,
  saveForLater: boolean,
): Promise<AbandonResult> {
  const res = await fetch("/api/payments/abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, saveForLater }),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as {
    ok?: boolean;
    paid?: boolean;
    error?: string;
  } | null;
  if (data?.paid) return { ok: false, paid: true };
  if (res?.ok && data?.ok) return { ok: true };
  return {
    ok: false,
    message:
      data?.error === "UNAUTHORIZED" || data?.error === "FORBIDDEN"
        ? "Энэ захиалгыг өөрчлөхийн тулд захиалсан бүртгэлээрээ нэвтэрнэ үү."
        : data?.error === "CHECK_FAILED"
          ? "Төлбөрийн төлөвийг шалгаж чадсангүй. Хэдэн секундын дараа дахин оролдоно уу."
          : data?.error === "NO_SNAPSHOT"
            ? "Энэ захиалгыг хадгалах боломжгүй байна. «Устгах» эсвэл төлбөрөө төлнө үү."
            : data?.error === "NOT_PENDING"
              ? "Энэ захиалга төлбөр хүлээж буй төлөвт байхаа больсон."
              : "Үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.",
  };
}
