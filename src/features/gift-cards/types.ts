import type { GiftCardStatus } from "@/db/types";

/** Картын загвар — карт зурахад хэрэгтэй бүхэн (0179 `gift_card_designs`). */
export interface GiftCardDesign {
  id: string;
  title: string;
  heading: string;
  defaultMessage: string | null;
  /** Дэвсгэр зураг (текстгүй, 1200×756) — байхгүй бол `bgColor`. */
  imageUrl: string | null;
  bgColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string | null;
}

/** Картын нүүрэнд бичигдэх текст (код ОРОХГҮЙ — зураг хуваалцагдана). */
export interface GiftCardFaceText {
  amount: number;
  recipientName: string;
  message: string;
  fromName: string;
}

/**
 * `/gift/[token]` — хүлээн авагчийн харах хэсэг. Token нь эрх; код энд
 * байхгүй (холбоос дамжиж болно, код нь нэг удаа оноо болох нууц).
 */
export interface GiftCardPublicView extends GiftCardFaceText {
  token: string;
  status: GiftCardStatus;
  expiresAt: string | null;
  design: GiftCardDesign;
  /** Нэвтэрсэн хэрэглэгч өөрөө оноо болгосон эсэх. */
  redeemedByViewer: boolean;
  /** Нэвтэрсэн хэрэглэгч энэ картыг худалдаж авсан эсэх (өөрөө бүү ав). */
  viewerIsBuyer: boolean;
  redeemedAt: string | null;
}

/** «Миний бэлгийн карт» — худалдан авсан ба хүлээн авсан. */
export interface MyGiftCard extends GiftCardFaceText {
  id: string;
  role: "bought" | "received";
  status: GiftCardStatus;
  design: GiftCardDesign;
  /** Зөвхөн худалдан авагчид, ашиглагдаагүй үед (хуваалцах). */
  code: string | null;
  token: string | null;
  recipientEmail: string | null;
  /** Товлосон илгээлт (худалдан авагчид). */
  sendAt: string | null;
  sentAt: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  points: number | null;
  orderId: string;
  createdAt: string;
}
