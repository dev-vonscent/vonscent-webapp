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
});
