import { GIFT_SAMPLE_ML } from "@/lib/constants";

/**
 * Сагс нэг барааны эх савнаас ХЭДЭН ml «идэж» байна вэ.
 *
 * Үлдэгдэл нь бараа тус бүрийн ml-ийн НӨӨЦ (`inventory.available_ml`), харин
 * сагс нь тэр нөөцийг олон янзаар хэрэглэнэ: энгийн мөр, багцын гишүүн,
 * «Захиалах» мөр, бэлгийн 1ml дээж. Хэмжээ тус бүрийг тусад нь шалгах нь
 * хангалтгүй — 10ml + 5ml гэсэн хоёр мөр тус тусдаа «зарагдана» ч нийлээд
 * 15ml-ийн үлдэгдлийг бүрэн дуусгана.
 *
 * Тиймээс хязгаарыг үргэлж ЭНД тооцсон нийлбэрээс хасаж бодно:
 *   remainingMl = availableMl − cartMlFor(productId, сагс)
 *
 * `server-only` БИШ: сагсны UI ба checkout-ийн сервер тал хоёулаа ижил
 * дүрмээр явна (`sellable.ts`-ийн `maxUnits`-тай хамт).
 */

export interface BudgetItem {
  productId: string;
  ml: number;
  qty: number;
}

export interface BudgetCollection {
  /** Багцын хэмжээ — гишүүн БҮР энэ ml-ээр цутгагдана. */
  ml: number;
  qty: number;
  members: readonly { productId: string }[];
}

export interface CartBudgetInput {
  items?: readonly BudgetItem[];
  collections?: readonly BudgetCollection[];
  /** Сонгосон 1ml бэлгийн дээжийн бараанууд. */
  giftProductIds?: readonly string[];
}

/** Бараа бүрээр сагсны хэрэглэж буй нийт ml. */
export function cartMlByProduct(input: CartBudgetInput): Map<string, number> {
  const out = new Map<string, number>();
  const add = (productId: string, ml: number) => {
    if (ml <= 0) return;
    out.set(productId, (out.get(productId) ?? 0) + ml);
  };

  // Мөрийг ӨӨРИЙГ нь хасах шаардлагатай бол (тэр мөрийн дээд хязгаарыг
  // бодох үед) дуудагч тал шүүж өгнө — энд дүрэм нэмэхгүй.
  for (const i of input.items ?? []) add(i.productId, i.ml * i.qty);
  for (const c of input.collections ?? []) {
    // Багцын гишүүн бүр багцын ml-ээр, багцын тоо ширхэгээр үржигдэнэ.
    for (const m of c.members) add(m.productId, c.ml * c.qty);
  }
  for (const id of input.giftProductIds ?? []) add(id, GIFT_SAMPLE_ML);

  return out;
}

/** Нэг барааны эх савнаас сагс хэдэн ml авсныг буцаана. */
export function cartMlFor(productId: string, input: CartBudgetInput): number {
  return cartMlByProduct(input).get(productId) ?? 0;
}
