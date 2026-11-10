import { describe, expect, it } from "vitest";
import { renderEmail } from "./layout";

const base = {
  preheader: "VS-1001 — төлбөр баталгаажлаа",
  heading: "Захиалга баталгаажлаа",
  paragraphs: ["Сайн байна уу!"],
};

describe("renderEmail", () => {
  it("renders both an html and a plain-text body from one document", () => {
    const { html, text } = renderEmail({
      ...base,
      items: [{ name: "Dior Sauvage", meta: "5ml × 2", amount: "40,000₮" }],
      lines: [{ label: "Нийт", value: "40,000₮", strong: true }],
      cta: { label: "Захиалгаа хянах", href: "https://vonscent.mn/account" },
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Dior Sauvage");
    expect(html).toContain("https://vonscent.mn/account");
    expect(text).toContain("Захиалга баталгаажлаа");
    expect(text).toContain("· Dior Sauvage — 5ml × 2: 40,000₮");
    expect(text).toContain("Нийт: 40,000₮");
    expect(text).not.toContain("<");
  });

  it("escapes user-supplied content", () => {
    const { html } = renderEmail({
      ...base,
      paragraphs: ['<script>alert("x")</script>'],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("refuses a non-http link in a cta", () => {
    const { html } = renderEmail({
      ...base,
      cta: { label: "Дар", href: "javascript:alert(1)" },
    });
    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:");
  });

  it("adds the unsubscribe link only when a token url is given", () => {
    const without = renderEmail(base);
    expect(without.text).not.toContain("Мэдэгдэл авахаа болих");

    const withLink = renderEmail({
      ...base,
      unsubscribeUrl: "https://vonscent.mn/api/newsletter/unsubscribe?token=t",
    });
    expect(withLink.html).toContain("unsubscribe?token=t");
    expect(withLink.text).toContain("Мэдэгдэл авахаа болих");
  });

  it("бэлгийн картын блокууд (зураг, код, алхам, QR) html ба текстэд", () => {
    const doc = renderEmail({
      ...base,
      hero: {
        src: "https://vonscent.mn/api/gift-cards/t/image",
        alt: "Бэлгийн карт",
        width: 600,
        height: 378,
        href: "https://vonscent.mn/gift/t",
      },
      code: { label: "Бэлгийн код", value: "VON-7K4P-Q9XM" },
      steps: { title: "Хэрхэн ашиглах вэ", items: ["Дарна", "Бүртгүүлнэ"] },
      qr: { src: "https://vonscent.mn/qr.png", alt: "QR", caption: "Утсаар уншуул" },
    });
    expect(doc.html).toContain('src="https://vonscent.mn/api/gift-cards/t/image"');
    expect(doc.html).toContain("VON-7K4P-Q9XM");
    expect(doc.html).toContain("Утсаар уншуул");
    expect(doc.text).toContain("Бэлгийн код: VON-7K4P-Q9XM");
    expect(doc.text).toContain("2. Бүртгүүлнэ");
  });

  it("зурагт https-ээс өөр src зөвшөөрөхгүй", () => {
    const doc = renderEmail({
      ...base,
      hero: { src: "data:image/png;base64,AAA", alt: "x", width: 1, height: 1 },
    });
    expect(doc.html).not.toContain("data:image");
  });
});
