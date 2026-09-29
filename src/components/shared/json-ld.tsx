import { SITE } from "@/lib/constants";
import type { ProductDetail } from "@/lib/types";
import type { BlogPost } from "@/features/blog/seed";

/**
 * schema.org structured data (JSON-LD) helpers. Rendered as a plain script
 * tag from server components; content is JSON.stringify-ed (never user HTML),
 * with `<` escaped so markup inside strings can't close the script tag.
 */

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</gu, "\\u003c"),
      }}
    />
  );
}

/**
 * Home-page entity: brand name, logo and contact channels for Google's
 * knowledge panel / sitelinks. Blank social fields are dropped.
 */
export function organizationJsonLd(social: {
  instagram: string;
  facebook: string;
  phone: string;
  email: string;
}): Json {
  const sameAs = [social.instagram, social.facebook].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon.png`,
    ...(sameAs.length ? { sameAs } : {}),
    ...(social.phone || social.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            areaServed: "MN",
            availableLanguage: "mn",
            ...(social.phone ? { telephone: social.phone } : {}),
            ...(social.email ? { email: social.email } : {}),
          },
        }
      : {}),
  };
}

/** Site name + catalog search box (the catalog reads `?q=`). */
export function websiteJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    inLanguage: "mn",
    publisher: { "@id": `${SITE.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/catalog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path?: string }[],
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: `${SITE.url}${item.path}` } : {}),
    })),
  };
}

export function productJsonLd(product: ProductDetail): Json {
  const prices = product.variants.filter((v) => v.isActive).map((v) => v.price);
  const low = prices.length ? Math.min(...prices) : product.startingPrice;
  const high = prices.length ? Math.max(...prices) : product.startingPrice;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    description: product.description,
    image: product.images.map((img) => img.url),
    url: `${SITE.url}/products/${product.slug}`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "MNT",
      lowPrice: low,
      highPrice: high,
      offerCount: prices.length || 1,
      availability: product.soldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };
}

export function articleJsonLd(post: BlogPost): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.cover ? [post.cover] : [],
    datePublished: post.date,
    url: `${SITE.url}/blog/${post.slug}`,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
