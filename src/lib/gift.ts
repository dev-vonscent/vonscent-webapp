import { GIFT_THRESHOLD } from "@/lib/constants";

/** Багц бүрийн баталгаат эрхийг тооцоход хэрэгтэй хэсэг. */
export interface GiftBundle {
  /** «base» = админы бэлдсэн preset багц, «custom» = өөрөө угсарсан. */
  type: "base" | "custom";
  ml: number;
  qty: number;
}

/** Баталгаат бэлэг өгдөг хамгийн бага preset хэмжээ (2мл багц эрх өгөхгүй). */
export const GIFT_GUARANTEE_MIN_ML = 5;

/**
 * Нэг багцын баталгаат бэлгийн эрх (backlog 2026-09-02, шийдвэр 2–3):
 *
 *   preset 5 / 10 / 20мл багц → хувь тутамд 1
 *   preset 2мл багц          → 0
 *   custom (өөрөө угсарсан)  → 0
 */
export function bundleGiftGuarantee(bundle: GiftBundle): number {
  if (bundle.type !== "base") return 0;
  if (bundle.ml < GIFT_GUARANTEE_MIN_ML) return 0;
  return Math.max(bundle.qty, 0);
}

/** Сагсан дахь бүх багцын баталгаат эрхийн нийлбэр. */
export function giftGuaranteeFor(bundles: GiftBundle[]): number {
  return bundles.reduce((n, b) => n + bundleGiftGuarantee(b), 0);
}

/**
 * 1мл бэлгийн эрхийн тоо:
 *
 *   цэвэр дүн   = барааны дүн − купоны хямдрал (хүргэлт, оноо ороогүй)
 *   дүнгийн эрх = ⌊цэвэр дүн ÷ 200,000⌋   ← дан бараа авсан ч бодогдоно
 *   эрх         = max(багцын баталгаа, дүнгийн эрх)   ← нэмэхгүй, ихийг нь авна
 *
 * Жишээ: дан 190K → 0 · дан 210K → 1 · custom багц 150K → 0 ·
 * custom багц 420K → 2 · preset 2мл багц 150K → 0 · preset 10мл багц 150K → 1 ·
 * preset 10мл багц 450K → 2.
 */
export function giftAllowanceFor(
  goodsAfterDiscount: number,
  bundleGuarantee = 0,
): number {
  return Math.max(
    Math.max(bundleGuarantee, 0),
    Math.floor(Math.max(goodsAfterDiscount, 0) / GIFT_THRESHOLD),
  );
}
