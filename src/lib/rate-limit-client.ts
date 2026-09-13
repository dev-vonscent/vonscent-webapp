/**
 * Хүсэлтийн хязгаарын (429) мессежийг клиент талд уншина.
 *
 * Сервер нь бэлэн монгол өгүүлбэрийг (`message`) буцаадаг — хэдэн секундын
 * дараа гэдэг нь бодлого бүрээр өөр тул клиент дээр давхар бичих утгагүй
 * (src/lib/rate-limit.ts). Хариуны биеийг нэг л удаа уншиж болдог тул
 * хариугаа өөрөө задалдаг дуудагч `data.message`-ыг шууд авна.
 */
export async function rateLimitMessage(res: Response): Promise<string | null> {
  if (res.status !== 429) return null;
  const data = (await res.json().catch(() => null)) as {
    message?: string;
  } | null;
  return (
    data?.message ??
    "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу."
  );
}
