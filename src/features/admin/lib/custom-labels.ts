/**
 * Гараар оруулсан шошго (`/admin/orders/labels`, `label_print`) — вэбээс
 * бус Facebook, Instagram, утсаар ирсэн захиалгын хаяг/усны шошго. Санд юу
 * ч хадгалахгүй; мөрүүд хуудсан дээр гараар, Excel-ээс хуулж буулгах эсвэл
 * файлаар (xlsx/csv) орж ирнэ. Энэ модуль canvas-гүй тул тестлэгдэнэ.
 */

export interface LabelColumn<K extends string = string> {
  key: K;
  label: string;
  /** Толгой мөрийн нэрийг танихад (жижиг үсгээр, агуулж байвал). */
  aliases: string[];
  /** Тийм/үгүй багана — хүснэгтэд checkbox, утга нь "1" эсвэл "". */
  bool?: boolean;
}

export const ADDRESS_COLUMNS = [
  { key: "name", label: "Нэр", aliases: ["нэр", "name", "хүлээн"] },
  { key: "phone", label: "Утас", aliases: ["утас", "phone", "tel"] },
  { key: "address", label: "Хаяг", aliases: ["хаяг", "address", "байршил"] },
  { key: "note", label: "Тэмдэглэл", aliases: ["тэмдэглэл", "note", "нэмэлт"] },
  {
    key: "remote",
    label: "Орон нутаг",
    aliases: ["орон нутаг", "аймаг", "remote"],
    bool: true,
  },
  {
    key: "giftWrap",
    label: "Бэлгийн боолт",
    aliases: ["бэлэг", "боолт", "gift"],
    bool: true,
  },
] as const satisfies readonly LabelColumn[];

export const PERFUME_COLUMNS = [
  { key: "brand", label: "Брэнд", aliases: ["брэнд", "brand"] },
  { key: "name", label: "Нэр", aliases: ["нэр", "name", "үнэртэн"] },
  { key: "ml", label: "ml", aliases: ["ml", "мл", "хэмжээ", "size"] },
  { key: "qty", label: "Тоо", aliases: ["тоо", "ширхэг", "qty", "count"] },
] as const satisfies readonly LabelColumn[];

export type AddressKey = (typeof ADDRESS_COLUMNS)[number]["key"];
export type PerfumeKey = (typeof PERFUME_COLUMNS)[number]["key"];
export type LabelValues<K extends string> = Record<K, string>;

/** Толгойг танихдаа шалгах дараалал: «Брэндийн нэр» → брэнд (нэр биш).
 *  Захиалгын дугаарын багана байхгүй (клиент, 2026-11) — «Захиалгын
 *  дугаар» толгойтой нүд алгасагдана, «Утасны дугаар» → утас. */
const MATCH_ORDER: Record<string, readonly string[]> = {
  address: ["phone", "remote", "giftWrap", "note", "address", "name"],
  perfume: ["brand", "ml", "qty", "name"],
};

/** Нэг удаад хэвлэх гараар оруулсан шошгоны дээд тоо (хувь орсон). */
export const CUSTOM_LABEL_MAX = 200;

/**
 * Excel-ээс хуулсан (tab) эсвэл CSV (`,`/`;`) текстийг хүснэгт болгоно.
 * Хашилттай нүд (дотроо мөр шилжилт, тусгаарлагчтай) зөв задрана. Хоосон
 * мөрүүд хасагдана.
 */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const first = src.split("\n", 1)[0] ?? "";
  const delimiter = first.includes("\t")
    ? "\t"
    : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Толгой мөрийн нүд бүрийг баганын түлхүүрт буулгана; танигдаагүй нүд
 * `null`. Хоёроос цөөн багана танигдвал толгой биш гэж үзэж `null`.
 */
export function matchHeader<K extends string>(
  header: readonly string[],
  columns: readonly LabelColumn<K>[],
  kind: "address" | "perfume",
): (K | null)[] | null {
  const order = MATCH_ORDER[kind]
    .map((key) => columns.find((c) => c.key === key))
    .filter((c): c is LabelColumn<K> => Boolean(c));
  const used = new Set<K>();
  const keys = header.map((cell) => {
    const h = norm(cell);
    if (!h) return null;
    const col = order.find(
      (c) => !used.has(c.key) && c.aliases.some((a) => h.includes(a)),
    );
    if (!col) return null;
    used.add(col.key);
    return col.key;
  });
  return used.size >= 2 ? keys : null;
}

/**
 * Хүснэгтийг мөрүүд болгоно. Эхний мөр толгой бол түүгээр баганыг
 * тааруулна; үгүй бол `startCol`-оос эхлэн хүснэгтийн баганын дарааллаар
 * (Excel-ээс тодорхой нүдэнд буулгахад тэр нүднээс баруун тийш).
 */
export function tableToValues<K extends string>(
  table: readonly string[][],
  columns: readonly LabelColumn<K>[],
  kind: "address" | "perfume",
  startCol = 0,
): LabelValues<K>[] {
  if (table.length === 0) return [];
  const header = matchHeader(table[0], columns, kind);
  const keys: (K | null)[] =
    header ?? columns.slice(startCol).map((c) => c.key);
  const body = header ? table.slice(1) : table;
  return body
    .map((cells) => {
      const values = Object.fromEntries(
        columns.map((c) => [c.key, ""]),
      ) as LabelValues<K>;
      keys.forEach((key, i) => {
        if (!key) return;
        const col = columns.find((c) => c.key === key)!;
        const raw = cells[i]?.trim() ?? "";
        values[key] = col.bool ? (parseBool(raw) ? "1" : "") : raw;
      });
      return values;
    })
    .filter((v) => !isBlank(v, columns));
}

/** Тийм/үгүй нүд: «1», «тийм», «yes», «x», «✓», «true», «+» г.м. */
export function parseBool(raw: string): boolean {
  const v = norm(raw);
  if (!v) return false;
  return !["0", "үгүй", "no", "n", "false", "-", "—"].includes(v);
}

/** Текст багана бүр хоосон (checkbox-ыг тооцохгүй). */
export function isBlank<K extends string>(
  values: LabelValues<K>,
  columns: readonly LabelColumn<K>[],
): boolean {
  return columns.every((c) => c.bool || !values[c.key]?.trim());
}

/** «5ml», «5 мл» → 5; тоогүй бол null. */
export function parseMl(raw: string): number | null {
  const m = raw.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return n > 0 && n < 1000 ? n : null;
}

/** Хоосон/буруу бол 1; 1–99. */
export function parseQty(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1;
}
