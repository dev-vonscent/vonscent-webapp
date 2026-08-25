import { GIFT_THRESHOLD } from "@/lib/constants";

/**
 * Сар бүрийн 1мл бэлгийн эрхийн тоо (requirement_final.md «Тодруулга»):
 *
 *   - Барааны цэвэр дүн (купон хассан, хүргэлт/оноо ороогүй) 200,000₮ тутамд 1;
 *   - Багц бүр өөрөө 1 эрх өгнө — 200,000₮ хүрээгүй багц ч бэлэгтэй,
 *     2 багц = 2 эрх, харин нийт дүн нь босгоор илүү өгвөл (2 багц 600,000₮+
 *     = 3) дүнгээр бодсон тоо нь ялна.
 *
 * Хоёр дүрмийн ихийг авснаар бүх жишээ биелнэ: 190,000₮ дан ус = 0;
 * 150,000₮-ийн 1 багц = 1; 1 багц 400,000₮+ = 2; 2 багц 600,000₮+ = 3.
 */
export function giftAllowanceFor(
  goodsAfterDiscount: number,
  bundleQty: number,
): number {
  return Math.max(
    Math.max(bundleQty, 0),
    Math.floor(Math.max(goodsAfterDiscount, 0) / GIFT_THRESHOLD),
  );
}
