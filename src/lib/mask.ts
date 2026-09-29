/**
 * Хувийн мэдээллийг маскална — хуваалцсан купоныг хэн ашигласныг эзэмшигчид
 * харуулахад (0104). Эзэмшигч найзаа танихад хангалттай, харин өөр хүний
 * бүтэн нэр, утас задрахгүй байх ёстой.
 */

/** «Болд» → «Б***». Хоосон бол null. */
export function maskName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const first = Array.from(trimmed)[0];
  return `${first.toUpperCase()}***`;
}

/** «+976 9911 2233» → «••2233». Цифр 4-өөс цөөн бол null. */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/gu, "");
  if (digits.length < 4) return null;
  return `••${digits.slice(-4)}`;
}
