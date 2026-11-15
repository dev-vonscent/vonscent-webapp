import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import { SALE_EVENT_DEFAULT_BADGE } from "@/lib/constants";
import { bulkSalePrice } from "@/lib/validators/sale";
import type { SaleEventProduct } from "../../types";
import { isValidPct, type StudioItem } from "./studio-model";

/**
 * ③-р алхмын каталогийн жишээ харагдацын (studio-ux.md §5.3) цэвэр хэсэг.
 * Зөвхөн админы урьдчилсан харагдац — дэлгүүрийн үнэ DB-ийн `variant_price`
 * хэвээр (plan §5.2).
 */

export const PREVIEW_CARD_COUNT = 4;

export interface PreviewCard {
  id: string;
  name: string;
  brand: string;
  image: string | null;
  /** Картын «эхлэх үнэ» — хямдралын дараах хамгийн бага. Үнэгүй бол null. */
  price: number | null;
  /** Тэр хэмжээний үндсэн үнэ (хямдарсан үед зураастай гарна). */
  basePrice: number | null;
  /** Дор хаяж нэг хэмжээ хямдарсан — «Хямдрал» тэмдэг гарах эсэх. */
  discounted: boolean;
}

/**
 * ②-т сонгосон эхний 4 бараа, хямдарсан үнэтэйгээ. Хувийг ②-ын хүснэгттэй
 * ижил туслахаар (`bulkSalePrice`) тооцно. Нуусан / устгасан бараа алгасна.
 */
export function previewCards(
  items: readonly StudioItem[],
  byId: ReadonlyMap<string, SaleEventProduct>,
  limit = PREVIEW_CARD_COUNT,
): PreviewCard[] {
  const out: PreviewCard[] = [];
  for (const item of items) {
    if (out.length >= limit) break;
    const p = byId.get(item.productId);
    if (!p) continue;
    let price: number | null = null;
    let basePrice: number | null = null;
    let discounted = false;
    const sizes = Object.entries(p.prices)
      .map(([ml, base]) => [Number(ml), base] as const)
      .sort((a, b) => a[0] - b[0]);
    for (const [ml, base] of sizes) {
      const pct = item.pcts[ml];
      const sale =
        pct !== undefined && isValidPct(pct)
          ? bulkSalePrice(base, Number(pct))
          : base;
      if (sale < base) discounted = true;
      if (price === null || sale < price) {
        price = sale;
        basePrice = base;
      }
    }
    out.push({
      id: p.id,
      name: p.name,
      brand: p.brand,
      image: p.image,
      price,
      basePrice,
      discounted,
    });
  }
  return out;
}

/**
 * Картын тэмдэг — дэлгүүрийн `SaleBadge`-ийн дүрэм: арга хэмжээний тэмдэг
 * байвал тэр; хоосон бол зөвхөн хямдарсан бараанд «Хямдрал».
 */
export function previewBadge(
  badgeLabel: string,
  discounted: boolean,
): string | null {
  return badgeLabel.trim() || (discounted ? SALE_EVENT_DEFAULT_BADGE : null);
}

/**
 * Тоолуур «эхлэх мөчид ингэж харагдана»: дуусах − эхлэх (мс). Огноо дутуу
 * эсвэл урвуу бол null.
 */
export function previewDuration(startsOn: string, endsOn: string): number | null {
  const start = dayStartIso(startsOn);
  const end = dayEndIso(endsOn);
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  return ms > 0 ? ms : null;
}
