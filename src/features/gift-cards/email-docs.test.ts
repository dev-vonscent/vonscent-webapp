import { describe, expect, it } from "vitest";
import { renderEmail } from "@/lib/email/layout";
import { recipientEmail, reminderEmail } from "./email-docs";

const card = {
  token: "a".repeat(32),
  amount: 100000,
  from_name: "Болд",
  recipient_name: "Сараа",
  message: "Төрсөн өдрийн мэнд!",
  code: "VON-7K4P-Q9XM",
  expires_at: "2027-11-10T00:00:00Z",
};

describe("recipientEmail", () => {
  it("холбоос, код, QR, мэндчилгээ, хугацаа бүгд орно", () => {
    const { subject, doc } = recipientEmail(card, "https://vonscent.mn/");
    const { html, text } = renderEmail(doc);
    expect(subject).toBe("Болд танд Vonscent-ийн бэлгийн карт илгээлээ");
    expect(html).toContain(`https://vonscent.mn/gift/${card.token}`);
    expect(html).toContain(`https://vonscent.mn/api/gift-cards/${card.token}/qr`);
    expect(html).toContain("VON-7K4P-Q9XM");
    expect(text).toContain("«Төрсөн өдрийн мэнд!» — Болд");
    expect(text).toMatch(/хүртэл оноо болгох боломжтой/u);
  });

  it("мэндчилгээгүй бол note хоосон", () => {
    const { doc } = recipientEmail({ ...card, message: null }, "https://vonscent.mn");
    expect(doc.note).toBeUndefined();
  });
});

describe("reminderEmail", () => {
  it("ашиглаагүй сануулга нэр, код, холбоостой", () => {
    const { subject, doc } = reminderEmail(card, "unused", "https://vonscent.mn");
    expect(subject).toBe("Сараа, таны бэлэг хүлээж байна");
    expect(renderEmail(doc).html).toContain("VON-7K4P-Q9XM");
  });

  it("хугацааны сануулга 7 / 30 хоногийг гарчигт", () => {
    expect(reminderEmail(card, "expiry_7", "https://vonscent.mn").subject).toMatch(/7 хоног/u);
    expect(reminderEmail(card, "expiry_30", "https://vonscent.mn").subject).toMatch(/30 хоног/u);
  });
});
