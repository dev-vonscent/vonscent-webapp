import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/constants";
import { breadcrumbJsonLd, jsonLdScripts } from "./json-ld";

type Item = { position: number; name: string; item?: string };

describe("breadcrumbJsonLd", () => {
  const data = breadcrumbJsonLd([
    { name: "Нүүр", path: "" },
    { name: "Каталог", path: "/catalog" },
    { name: "Sauvage", path: "/products/dior-sauvage" },
    { name: "Сүүлчийн" },
  ]);
  const items = data.itemListElement as Item[];

  it("gives the home step a URL — Google needs `item` on all but the last", () => {
    expect(items[0]).toMatchObject({ position: 1, item: SITE.url });
  });

  it("builds absolute URLs from paths", () => {
    expect(items[1]?.item).toBe(`${SITE.url}/catalog`);
    expect(items[2]?.item).toBe(`${SITE.url}/products/dior-sauvage`);
  });

  it("omits `item` only when no path is given", () => {
    expect(items[3]).not.toHaveProperty("item");
  });

  it("numbers positions from 1", () => {
    expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4]);
  });
});

describe("jsonLdScripts", () => {
  it("emits one object per script so no block is a top-level array", () => {
    const out = jsonLdScripts([
      { "@context": "https://schema.org", "@type": "Product" },
      { "@context": "https://schema.org", "@type": "BreadcrumbList" },
    ]);
    expect(out).toHaveLength(2);
    for (const body of out) {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      expect(Array.isArray(parsed)).toBe(false);
      expect(parsed["@context"]).toBe("https://schema.org");
    }
  });

  it("wraps a single object", () => {
    expect(jsonLdScripts({ "@type": "FAQPage" })).toEqual([
      '{"@type":"FAQPage"}',
    ]);
  });

  it("escapes `<` so a string can't close the script tag", () => {
    const [body] = jsonLdScripts({ name: "</script><b>" });
    expect(body).not.toContain("<");
    expect(JSON.parse(body!)).toEqual({ name: "</script><b>" });
  });
});
