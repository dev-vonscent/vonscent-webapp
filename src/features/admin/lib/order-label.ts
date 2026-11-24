import type { OrderRow } from "@/db/types";

/**
 * Хүргэлтийн шошгоны (0202, `label_print`) мөрүүд — canvas-аас тусдаа тул
 * тестлэгдэнэ (клиент, 2026-11): эхний мөр зөвхөн захиалгын дугаар (тод),
 * бэлгийн боолттой бол тэр мөрийн баруун захад 🎁 дүрс (бичиггүй), дараа нь
 * «Нэр:», «Утас:», «Хаяг:» (орон нутагт «Орон нутаг:»),
 * «Тэмдэглэл:» — талбарын нэр тод, утга энгийн. Хоосон тэмдэглэл гарахгүй.
 */
export interface LabelSegment {
  text: string;
  bold: boolean;
}

export interface OrderLabelLine {
  segments: LabelSegment[];
  /** Мөрийн баруун захад зурах дүрс (бэлгийн боолт). */
  icon?: "gift";
}

export type OrderLabelSource = Pick<
  OrderRow,
  | "order_no"
  | "contact_name"
  | "contact_phone"
  | "ship_city"
  | "ship_district"
  | "ship_detail"
  | "ship_zone"
  | "note"
>;

/**
 * Checkout-ийн үнэгүй «Бэлгийн боолт хийлгэх» chip — тэмдэглэлийн эхэнд
 * « · »/« — »-ээр нийлж хадгалагддаг (checkout/page.tsx `NOTE_OPTIONS`).
 */
export const GIFT_WRAP_NOTE = "Бэлгийн боолт хийлгэх";

/** Тэмдэглэлээс бэлгийн боолтын chip-ийг салгана. */
export function splitGiftWrapNote(note: string | null | undefined): {
  giftWrap: boolean;
  note: string | null;
} {
  const raw = note?.trim() ?? "";
  if (!raw.includes(GIFT_WRAP_NOTE))
    return { giftWrap: false, note: raw || null };
  const rest = raw
    .replace(GIFT_WRAP_NOTE, "")
    .replace(/^[\s·—-]+|[\s·—-]+$/g, "")
    .trim();
  return { giftWrap: true, note: rest || null };
}

const field = (label: string, value: string): OrderLabelLine => ({
  segments: [
    { text: `${label}:`, bold: true },
    { text: value, bold: false },
  ],
});

export function orderLabelLines(
  o: OrderLabelSource,
  opts: { giftWrap?: boolean; remote?: boolean } = {},
): OrderLabelLine[] {
  // Захиалгын дэлгэрэнгүй хуудастай ижил дараалал: хот, дүүрэг, дэлгэрэнгүй.
  // Бүсийн код (A, B …) шошгон дээр хэрэггүй (клиент, 2026-11).
  const address = [o.ship_city, o.ship_district, o.ship_detail]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  const { giftWrap: chip, note } = splitGiftWrapNote(o.note);
  const giftWrap = Boolean(opts.giftWrap) || chip;
  return [
    {
      segments: [{ text: o.order_no, bold: true }],
      ...(giftWrap ? { icon: "gift" as const } : {}),
    },
    field("Нэр", o.contact_name.trim()),
    field("Утас", o.contact_phone.trim()),
    field(opts.remote ? "Орон нутаг" : "Хаяг", address),
    ...(note ? [field("Тэмдэглэл", note)] : []),
  ];
}

/**
 * Холимог жинтэй (тод/энгийн) мөрийг үгээр нь өргөнд багтаан хуваана.
 * Үг бүр өөрийн хэсгийн жинтэй үлдэнэ. `indent` — эхний мөрөнд нөөцлөх
 * зай (дүрсний өргөн). Ганц үг багтахгүй бол тэмдэгтээр таслана.
 */
export function wrapSegments(
  segments: readonly LabelSegment[],
  maxWidth: number,
  measure: (text: string, bold: boolean) => number,
  indent = 0,
): LabelSegment[][] {
  const words = segments.flatMap((seg) =>
    seg.text
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((w) =>
        wrapText(w, maxWidth, (s) => measure(s, seg.bold)).map((text) => ({
          text,
          bold: seg.bold,
        })),
      ),
  );
  const lines: LabelSegment[][] = [];
  let line: LabelSegment[] = [];
  let width = indent;
  for (const word of words) {
    const space = line.length ? measure(" ", word.bold) : 0;
    const w = measure(word.text, word.bold);
    if (line.length && width + space + w > maxWidth) {
      lines.push(line);
      line = [];
      width = 0;
    }
    line.push(word);
    width += (line.length > 1 ? space : 0) + w;
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Усны шошгоны мөр — /api/admin/orders/label-items-ийн хариу. */
export interface PerfumeLabelItem {
  order_id: string;
  brand: string;
  name: string;
  /** Савны хэмжээ (2/5/10/20) — шошгоны буланд. */
  ml: number;
  qty: number;
}

export interface PerfumeLabelLayout {
  brandPx: number;
  namePx: number;
  /** 1–2 мөр. */
  nameLines: string[];
}

/**
 * Усны хаягийн байршил (niimbot.xlsx-ийн memo + клиентийн сонгосон «D2»
 * загвар, 2026-11): брэнд заавал нэг мөрөнд, усны нэрээс жижиг
 * (`brandRatio`); нэр нэг мөрөнд багтахгүй бол хоёр мөрөнд — нийт гурваас
 * илүүгүй. Хооронд нь `ruleHeight` өндөртэй ◆ зураас. Нэрийг эхэлж
 * багтааж, брэндийг түүнээс тооцно; өндөрт багтахгүй бол бүгд хамт
 * жижгэрнэ. `measure` нь canvas-аас (брэнд tracking-тэй хэмжигдэнэ).
 */
export function perfumeLabelLayout(opts: {
  brand: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  startPx: number;
  lineGap: number;
  ruleHeight: number;
  brandRatio: number;
  measure: (text: string, px: number, part: "brand" | "name") => number;
}): PerfumeLabelLayout {
  const { maxWidth, maxHeight, lineGap, ruleHeight, brandRatio, measure } =
    opts;
  const brand = opts.brand.trim();
  const name = opts.name.trim();
  const minPx = 4;
  const shrink = 0.95;

  let px = opts.startPx;
  for (;;) {
    let namePx = px;
    let nameLines = wrapText(name, maxWidth, (s) => measure(s, namePx, "name"));
    while (namePx > minPx && nameLines.length > 2) {
      namePx *= shrink;
      nameLines = wrapText(name, maxWidth, (s) => measure(s, namePx, "name"));
    }
    let brandPx = namePx * brandRatio;
    while (brandPx > minPx && measure(brand, brandPx, "brand") > maxWidth) {
      brandPx *= shrink;
    }
    const height = (brandPx + nameLines.length * namePx) * lineGap + ruleHeight;
    if (height <= maxHeight || px <= minPx) {
      return { brandPx, namePx, nameLines: nameLines.slice(0, 2) };
    }
    px *= shrink;
  }
}

/**
 * Үгээр нь мөр болгон хуваана; `maxWidth`-ээс урт ганц үгийг тэмдэгтээр
 * таслана. `measure` нь canvas-ын `measureText(..).width` (тестэд хуурамч).
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Ганц үг багтахгүй (урт хаяг, URL) — тэмдэгтээр тасална.
      let rest = word;
      while (measure(rest) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}
