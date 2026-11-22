/**
 * Хүрдний «Хоосон» зөвлөгөөний текст дэх утгын орлуулга (task 8.4).
 *
 * Зөвлөгөө нь админы бичсэн чөлөөт текст (`settings.spin.missTips`) тул
 * «мэдээллээ бөглөөд 1000 Vpoint» гэх мэт тоо шууд бичигдэж, тохиргоо
 * (`settings.loyalty.profilePoints`) өөрчлөгдөхөд хуучирдаг байв. Одоо
 * текстэд `{profilePoints}` / `{reviewPoints}` бичвэл харуулах үед
 * тохиргооны одоогийн утгаар (1,000 гэх мэт) солигдоно.
 */
export const TIP_TOKENS = {
  /** «Миний мэдээлэл» бөглөсний урамшуулал (`profilePoints`). */
  profilePoints: "{profilePoints}",
  /** Сэтгэгдлийн урамшуулал (`reviewPoints`). */
  reviewPoints: "{reviewPoints}",
} as const;

export type TipTokenValues = Record<keyof typeof TIP_TOKENS, number>;

/** Текст дэх токенуудыг тоогоор (мянгатын таслалтай) солино. */
export function fillTipTokens(text: string, values: TipTokenValues): string {
  let out = text;
  for (const key of Object.keys(TIP_TOKENS) as (keyof typeof TIP_TOKENS)[]) {
    out = out.split(TIP_TOKENS[key]).join(values[key].toLocaleString("mn-MN"));
  }
  return out;
}
