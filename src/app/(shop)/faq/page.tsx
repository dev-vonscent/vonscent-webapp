import type { Metadata } from "next";
import { getFaqs } from "@/features/faq/api";
import { FaqSearch } from "@/features/faq/components/faq-search";
import { JsonLd, faqJsonLd } from "@/components/shared/json-ld";
import { sanitizeHtml, isRichText } from "@/lib/sanitize";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Түгээмэл асуулт",
  description: "Захиалга, хүргэлт, төлбөр, бараатай холбоотой түгээмэл асуулт.",
};

export default async function FaqPage() {
  // Rich-text answers are sanitized here (server) — the client search
  // component renders them with innerHTML as-is.
  const faqs = (await getFaqs()).map((f) =>
    isRichText(f.answer) ? { ...f, answer: sanitizeHtml(f.answer) } : f,
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-8">
      <JsonLd data={faqJsonLd(faqs)} />
      <h1 className="text-center font-serif text-4xl font-semibold tracking-tight">
        Түгээмэл асуулт
      </h1>
      <FaqSearch items={faqs} />
    </div>
  );
}
