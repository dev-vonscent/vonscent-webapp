import type { EmailDoc } from "@/lib/email/layout";
import { formatDate } from "@/lib/format";
import type { GiftCardRow } from "@/db/types";
import { formatGiftAmount, giftUrl } from "./lib";

/**
 * Бэлгийн картын имэйлийн агуулга (gift-cards-plan §6.1) — цэвэр функц, тест
 * ба урьдчилан харахад. Илгээх нь `email.ts`.
 */
const STEPS = [
  "«Бэлгээ авах» товч дээр дарна (эсвэл доорх QR-ийг утсаараа уншуулна).",
  "Утасны дугаараараа бүртгүүлнэ — SMS-ээр баталгаажна, хэдхэн секунд.",
  "Картын дүн V point болж дансанд тань орно (1 оноо = 1₮). Үнэртэн сонгоод төлбөр төлөхдөө «V point ашиглах»-ыг сонгоорой.",
];

export function recipientEmail(
  card: Pick<
    GiftCardRow,
    "token" | "amount" | "from_name" | "recipient_name" | "message" | "code" | "expires_at"
  >,
  siteUrl: string,
): { subject: string; doc: EmailDoc } {
  const link = giftUrl(card.token, siteUrl);
  const amount = formatGiftAmount(card.amount);
  const base = siteUrl.replace(/\/+$/u, "");
  return {
    subject: `${card.from_name} танд Vonscent-ийн бэлгийн карт илгээлээ`,
    doc: {
      preheader: `${amount}-ийн үнэрийн бэлэг таныг хүлээж байна`,
      hero: {
        src: `${base}/api/gift-cards/${card.token}/image`,
        alt: `Vonscent бэлгийн карт — ${amount}`,
        width: 504,
        height: 318,
        href: link,
      },
      heading: `${card.recipient_name}, танд бэлэг ирлээ`,
      paragraphs: [
        `${card.from_name} танд Vonscent-ээс ${amount}-ийн бэлгийн карт илгээлээ. ` +
          "Картын дүн V point болж таны дансанд орох бөгөөд хүссэн үнэртнээ өөрөө сонгоно.",
      ],
      note: card.message ? `«${card.message}» — ${card.from_name}` : undefined,
      cta: { label: "Бэлгээ авах", href: link },
      code: { label: "Эсвэл кодоо гараар оруулна", value: card.code },
      steps: { title: "Хэрхэн ашиглах вэ", items: STEPS },
      qr: {
        src: `${base}/api/gift-cards/${card.token}/qr`,
        alt: "Бэлгийн холбоосын QR",
        caption:
          "Имэйлээ компьютерээс нээсэн бол утсаараа уншуулаад шууд нээгээрэй.",
      },
      footerNotes: [
        card.expires_at
          ? `Кодыг ${formatDate(card.expires_at)} хүртэл оноо болгоно. Оноо болсны дараа хугацаагүй.`
          : "Кодыг 1 жилийн дотор оноо болгоно. Оноо болсны дараа хугацаагүй.",
        "Асуулт байвал энэ имэйлд хариу бичээрэй — бид туслая.",
      ],
    },
  };
}

