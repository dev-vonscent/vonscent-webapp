/**
 * Захиалгын мөрүүдийг харуулах дараалал ба багцын бүлэглэлт — хэрэглэгчийн
 * ба админы захиалгын дэлгэрэнгүй, нэхэмжлэх, Telegram бүгд эндээс (task
 * 11, 12; клиент 2026-11).
 *
 * Дараалал (админ захиалга бэлдэхэд хялбар):
 *   1. Дан үнэртэн — ml өсөхөөр (2 → 5 → 10 → 20)
 *   2. Нэмэлт бараа, бэлгийн карт (ml-гүй)
 *   3. Багцууд — ml өсөхөөр, гишүүд нь `line_no`-оор
 *   4. Бэлэг — эхлээд хүрдний шагнал, дараа нь сарын 1ml бэлэг
 * Ижил бүлэг дотор `line_no` (0149, place_order-ийн дараалал), дараа нь `id`.
 * 0149-өөс өмнөх захиалгад `line_no` байхгүй — `id`-аар тогтмол (санамсаргүй
 * биш) дараалал.
 *
 * Багц захиалгад гишүүн бүрээрээ тусдаа мөр болж ордог (0029b: ижил qty).
 *   · Бэлэн (`base`) багц: түлхүүр `collection_id + ml` — сагс ижил
 *     багц+хэмжээг qty болгож нэгтгэдэг тул захиалгад давхардахгүй.
 *   · Угсарсан багц: `collection_id` нь ихэвчлэн null, нэр нь үргэлж
 *     «Миний багц» — `collection_name + ml` дээр `line_no` тасарвал,
 *     бараа давтагдвал эсвэл qty өөр бол шинэ багц. `line_no`-гүй хуучин
 *     захиалгад нэр + ml.
 *   · Хүрдний шагнал болох бүтэн багц (бэлэг) — тусдаа, бэлгийн хэсэгт.
 *
 * Мөрийн үнэ нь ҮНДСЭН үнэ (`list_price × qty`), багцынх гишүүдийнхээ
 * нийлбэр — хямдрал нь «Дүн» задаргаанд тусдаа мөр тул мөрүүдийн нийлбэр
 * = «Барааны дүн» (`gross_subtotal`). Мөнгөн тооцоо энд өөрчлөгдөхгүй.
 */

export interface OrderLineInput {
  id: string;
  product_name: string;
  brand: string | null;
  /** Нэмэлт бараа, бэлгийн картын мөрд (0146, 0179) null. */
  ml: number | null;
  qty: number;
  unit_price: number;
  list_price: number | null;
  is_gift: boolean;
  is_sample?: boolean;
  collection_id: string | null;
  collection_name: string | null;
  line_kind?: "perfume" | "extra" | "gift_card" | null;
  /** place_order-ийн дараалал (0149). Хуучин захиалгад null. */
  line_no?: number | null;
  /** Азын хүрдний шагнал (0165). */
  spin_id?: string | null;
  product_id?: string | null;
}

export interface BundleLine<T extends OrderLineInput> {
  kind: "bundle";
  /** React key — эхний гишүүний id. */
  key: string;
  /** Бэлэн (админы) эсвэл хэрэглэгчийн угсарсан багц. */
  type: "base" | "custom";
  /** Хүрдний шагнал болсон багц. */
  gift: boolean;
  name: string;
  ml: number;
  /** Хэдэн багц — гишүүдийн qty (бүгд ижил). */
  qty: number;
  /** Хямдралгүй нийт үнэ — гишүүдийн `list_price × qty` нийлбэр. */
  base: number;
  members: T[];
}

export type OrderLine<T extends OrderLineInput> =
  | { kind: "item"; item: T }
  | BundleLine<T>;

/** Мөрийн үндсэн дүн — «Барааны дүн»-д ордог утга. */
export function lineBase(
  i: Pick<OrderLineInput, "list_price" | "unit_price" | "qty">,
): number {
  return (i.list_price ?? i.unit_price) * i.qty;
}

/** Мөрийн харагдах дүн (дан мөр эсвэл бүтэн багц). */
export function orderLineAmount<T extends OrderLineInput>(
  l: OrderLine<T>,
): number {
  return l.kind === "bundle" ? l.base : lineBase(l.item);
}

/** «GENTLEMAN багц»; «Миний багц» дээр «багц»-ыг давхардуулахгүй. */
export function bundleTitle(
  l: Pick<BundleLine<OrderLineInput>, "name">,
): string {
  return /багц/i.test(l.name) ? l.name : `${l.name} багц`;
}

const isGiftLine = (i: OrderLineInput) => i.is_gift || Boolean(i.is_sample);
const isLabelLine = (i: OrderLineInput) =>
  i.line_kind === "extra" || i.line_kind === "gift_card" || i.ml == null;

function byLineNo(a: OrderLineInput, b: OrderLineInput): number {
  const an = a.line_no ?? Number.POSITIVE_INFINITY;
  const bn = b.line_no ?? Number.POSITIVE_INFINITY;
  if (an !== bn) return an < bn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const memberIdentity = (i: OrderLineInput) =>
  i.product_id ?? `${i.brand ?? ""}|${i.product_name}`;

/** Дэлгэцийн хэсэг — бага нь дээр. */
const Section = { Single: 0, Label: 1, Bundle: 2, Spin: 3, Gift: 4 } as const;
type Section = (typeof Section)[keyof typeof Section];

/**
 * Мөрүүдийг бүлэглэж, дэлгэцийн дарааллаар буцаана.
 * `baseCollectionIds` — бэлэн (`type = 'base'`) багцын id-ууд.
 */
export function buildOrderLines<T extends OrderLineInput>(
  items: readonly T[],
  baseCollectionIds: ReadonlySet<string>,
): OrderLine<T>[] {
  const sorted = [...items].sort(byLineNo);
  type Entry = { line: OrderLine<T>; section: Section; ml: number; at: number };
  const entries: Entry[] = [];
  /** Түлхүүр тус бүрийн сүүлийн (нээлттэй) багц. */
  const open = new Map<string, { line: BundleLine<T>; last: T }>();

  sorted.forEach((item, at) => {
    const gift = isGiftLine(item);
    const ml = item.ml;
    if (item.collection_name == null || ml == null || isLabelLine(item)) {
      entries.push({
        line: { kind: "item", item },
        section: gift
          ? item.spin_id
            ? Section.Spin
            : Section.Gift
          : isLabelLine(item)
            ? Section.Label
            : Section.Single,
        ml: ml ?? 0,
        at,
      });
      return;
    }

    const type =
      item.collection_id && baseCollectionIds.has(item.collection_id)
        ? "base"
        : "custom";
    const key = `${gift ? "g" : "p"}:${item.collection_id ?? `n:${item.collection_name}`}:${ml}`;
    const current = open.get(key);
    const startsNew =
      !current ||
      (type === "custom" &&
        ((item.line_no != null &&
          current.last.line_no != null &&
          item.line_no !== current.last.line_no + 1) ||
          item.qty !== current.line.qty ||
          current.line.members.some(
            (m) => memberIdentity(m) === memberIdentity(item),
          )));

    if (current && !startsNew) {
      current.line.qty = Math.max(current.line.qty, item.qty);
      current.line.base += lineBase(item);
      current.line.members.push(item);
      current.last = item;
      return;
    }

    const line: BundleLine<T> = {
      kind: "bundle",
      key: item.id,
      type,
      gift,
      name: item.collection_name,
      ml,
      qty: item.qty,
      base: lineBase(item),
      members: [item],
    };
    open.set(key, { line, last: item });
    entries.push({
      line,
      section: gift
        ? item.spin_id
          ? Section.Spin
          : Section.Gift
        : Section.Bundle,
      ml,
      at,
    });
  });

  // Дан үнэртэн ба багц ml-ээр; бусад нь `line_no`-гийн дарааллаар.
  const byMl = (s: Section) => s === Section.Single || s === Section.Bundle;
  return entries
    .sort(
      (a, b) =>
        a.section - b.section ||
        (byMl(a.section) ? a.ml - b.ml : 0) ||
        a.at - b.at,
    )
    .map((e) => e.line);
}

/** Задгай мөрүүд дэлгэцийн дарааллаар (нэхэмжлэх г.м. бүлэглэлгүй газарт). */
export function flattenOrderLines<T extends OrderLineInput>(
  lines: readonly OrderLine<T>[],
): T[] {
  return lines.flatMap((l) => (l.kind === "bundle" ? l.members : [l.item]));
}

/** Мөрүүдийн багцын id-ууд — `type`-ийг нь уншихад. */
export function collectionIdsOf(
  items: readonly Pick<OrderLineInput, "collection_id">[],
): string[] {
  return [
    ...new Set(
      items.map((i) => i.collection_id).filter((id): id is string => !!id),
    ),
  ];
}
