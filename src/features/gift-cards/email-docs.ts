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

/** Товлосон өдөр: «2026.12.01 09:00». */
export function formatSendAt(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day.replaceAll("-", ".")} ${time}`;
}

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


export type GiftReminderKind = "unused" | "expiry_30" | "expiry_7";

/**
 * Сануулга (gift-cards-plan §6.3) — нэг карт тутамд төрөл бүр нэг удаа.
 * Код, холбоос, хугацааг дахин өгнө: анхны имэйл spam-д унасан байж болно.
 */
export function reminderEmail(
  card: Pick<
    GiftCardRow,
    "token" | "amount" | "from_name" | "recipient_name" | "code" | "expires_at"
  >,
  kind: GiftReminderKind,
  siteUrl: string,
): { subject: string; doc: EmailDoc } {
  const link = giftUrl(card.token, siteUrl);
  const amount = formatGiftAmount(card.amount);
  const until = card.expires_at ? formatDate(card.expires_at) : null;
  const subject =
    kind === "unused"
      ? `${card.recipient_name}, таны бэлэг хүлээж байна`
      : `Бэлгийн картын хугацаа ${kind === "expiry_7" ? "7" : "30"} хоногийн дараа дуусна`;
  const lead =
    kind === "unused"
      ? `${card.from_name} танд ${amount}-ийн бэлгийн карт илгээсэн боловч хараахан ашиглаагүй байна. Нэг товчоор V point болгоод хүссэн үнэртнээ сонгоорой.`
      : `Танд ирсэн ${amount}-ийн бэлгийн картыг (илгээгч: ${card.from_name}) ${until ?? "удахгүй"} хүртэл оноо болгоно. Хугацаа дуусвал карт хүчингүй болно.`;
  return {
    subject,
    doc: {
      preheader:
        kind === "unused"
          ? `${amount}-ийн бэлгийн карт таныг хүлээж байна`
          : `${until ?? ""} хүртэл оноо болгоорой`,
      heading:
        kind === "unused" ? "Таны бэлэг хүлээж байна" : "Бэлгийн картын хугацаа дуусах гэж байна",
      paragraphs: [lead],
      cta: { label: "Бэлгээ авах", href: link },
      code: { label: "Эсвэл кодоо гараар оруулна", value: card.code },
      steps: { title: "Хэрхэн ашиглах вэ", items: STEPS },
      footerNotes: [
        "Оноо болсны дараа хугацаагүй — хүссэн үедээ зарцуулна.",
        "Асуулт байвал энэ имэйлд хариу бичээрэй — бид туслая.",
      ],
    },
  };
}
