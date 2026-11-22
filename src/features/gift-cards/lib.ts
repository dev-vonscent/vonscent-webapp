import type { GiftCardStatus } from "@/db/types";

/**
 * `/gift-cards`-ийн маягтын ноорог (sessionStorage): нэвтрэх рүү шилжихэд,
 * «Дараа захиалах»-аас үргэлжлүүлэхэд (`savedId`-тай) сэргээнэ.
 */
export const GIFT_CARD_DRAFT_KEY = "vonscent:gift-card-draft";

/** Хүлээн авагчийн хуудасны зам (`/gift/<token>`). */
export function giftPath(token: string): string {
  return `/gift/${token}`;
}

/** Хуваалцах бүтэн холбоос. */
export function giftUrl(token: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/u, "")}${giftPath(token)}`;
}

export const GIFT_STATUS_LABEL: Record<GiftCardStatus, string> = {
  pending: "Төлбөр хүлээж буй",
  active: "Ашиглаагүй",
  redeemed: "Оноо болсон",
  expired: "Хугацаа дууссан",
  void: "Хүчингүй",
};

/** ₮ → «100,000₮». Карт дээр мянганы таслалтай, зайгүй. */
export function formatGiftAmount(amount: number): string {
  return `${amount.toLocaleString("en-US")}₮`;
}

/** RPC-ийн `redeem_gift_card`-тай ижил кодын хэвшүүлэлт (0179). */
export function normalizeGiftCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^0-9A-Z]/gu, "");
  if (c.length === 11 && c.startsWith("VON")) {
    return `VON-${c.slice(3, 7)}-${c.slice(7, 11)}`;
  }
  if (c.length === 8) return `VON-${c.slice(0, 4)}-${c.slice(4, 8)}`;
  return null;
}
