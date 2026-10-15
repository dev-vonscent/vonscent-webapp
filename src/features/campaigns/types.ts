/** Бүртгүүлэхэд авсан бэлэг — мэндчилгээний цонхонд (`/api/campaigns/welcome`). */
export interface WelcomeGift {
  /** Нэг купоны дүн, ₮. */
  value: number;
  code: string;
  minSubtotal: number;
  /** Хүчинтэй хугацааны төгсгөл (ISO). */
  endsAt: string | null;
}
