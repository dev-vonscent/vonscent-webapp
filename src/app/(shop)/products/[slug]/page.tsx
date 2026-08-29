import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductGallery } from "@/features/products/components/product-gallery";
import { ProductPurchase } from "@/features/products/components/product-purchase";
import { TrackViewItem } from "@/features/products/components/track-view-item";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import { ProductCarousel } from "@/features/products/components/product-carousel";
import { SectionHeading } from "@/components/shared/section-heading";
import { getProductBySlug, getRelated } from "@/features/products/api";
import {
  JsonLd,
  breadcrumbJsonLd,
  productJsonLd,
} from "@/components/shared/json-ld";
import { getScentFamilyLabels } from "@/features/taxonomy/api";
import { ReviewSection } from "@/features/reviews/components/review-section";
import { GENDER_LABEL, SEASON_LABEL } from "@/lib/constants";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

// No prebuilt slugs — each page is generated on first visit, then served from
// the ISR cache. Without this, a dynamic segment renders on every request.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Бараа олдсонгүй" };
  return {
    title: `${product.name} — ${product.brand}`,
    // The short part is written to stand alone; fall back to the intro.
    description: (product.shortDescription || product.description).slice(
      0,
      160,
    ),
    // og:image comes from the sibling opengraph-image.tsx file convention.
    openGraph: { url: `/products/${product.slug}` },
  };
}

const TAG_LABEL: Record<string, string> = {
  new: "Шинэ",
  hot: "Эрэлттэй",
  sale: "Хямдрал",
};

function NoteColumn({ title, notes }: { title: string; notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <p className="text-sm">{notes.join(", ")}</p>
    </div>
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, familyLabelMap] = await Promise.all([
    getRelated(slug),
    getScentFamilyLabels(),
  ]);
  // A family the admin deleted still shows as its slug rather than vanishing.
  const familyLabels = product.scentFamilies.map((f) => familyLabelMap[f] ?? f);

  return (
    <div className="mx-auto max-w-352 p-4  sm:py-8 md:px-8">
      <JsonLd
        data={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: "Нүүр", path: "" },
            { name: "Каталог", path: "/catalog" },
            { name: product.name, path: `/products/${product.slug}` },
          ]),
        ]}
      />
      {/* Breadcrumb (hidden on mobile for a fuller hero image) */}
      <nav
        aria-label="Замын мөр"
        className="text-muted-foreground mb-6 hidden text-sm sm:block"
      >
        <ol className="flex flex-wrap items-center gap-x-1.5">
          <li>
            <Link href="/" className="hover:text-foreground">
              Нүүр
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/catalog" className="hover:text-foreground">
              Каталог
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <span className="text-foreground" aria-current="page">
              {product.name}
            </span>
          </li>
        </ol>
      </nav>

      <div className="grid gap-0 sm:gap-10 lg:grid-cols-2 lg:items-start">
        {/* Left: gallery sticks below the header while the right column scrolls,
            and releases when the grid ends (i.e. the related section appears). */}
        <div className="lg:sticky lg:top-(--header-offset) lg:self-start lg:transition-[top] lg:duration-300 lg:ease-out">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        {/* On mobile this panel slides up over the bottom of the image with a
            rounded top; resets to a plain column from sm up. Holds everything
            below the add-to-cart: notes, details and reviews. */}
        <div className="bg-background relative z-10 -mx-4 -mt-8 space-y-10 rounded-t-4xl px-4 pt-8 sm:mx-0 sm:mt-0 sm:rounded-none sm:bg-transparent sm:px-0 sm:pt-0">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm tracking-wide uppercase">
                  {product.brand}
                </span>
                {product.tags.map((t) => (
                  <Badge key={t} variant={t}>
                    {TAG_LABEL[t]}
                  </Badge>
                ))}
              </div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-serif text-3xl font-semibold tracking-tight">
                  {product.name}
                </h1>
                <WishlistButton
                  productId={product.id}
                  className="bg-secondary hover:bg-accent size-10 shrink-0"
                />
              </div>
            </div>

            <ProductPurchase product={product} />
            <TrackViewItem
              id={product.id}
              name={product.name}
              brand={product.brand}
              price={product.startingPrice}
            />
          </div>

          {/* Үнэрийн нот */}
          <div>
            <h2 className="mb-4 font-serif text-xl font-semibold">
              Үнэрийн нот
            </h2>
            <div className="bg-secondary grid grid-cols-1 gap-3 rounded-lg p-5 sm:grid-cols-3 sm:gap-4">
              <NoteColumn title="Дээд" notes={product.notesTop} />
              <NoteColumn title="Зүрх" notes={product.notesHeart} />
              <NoteColumn title="Суурь" notes={product.notesBase} />
            </div>
            {product.shortDescription && (
              <p className="text-muted-foreground text-sm">
                {product.shortDescription}
              </p>
            )}
          </div>

          <Accordion type="single" collapsible defaultValue="desc">
            {/* Four-part description (0022). Parts the admin left blank are
                skipped rather than opening onto an empty panel. */}
            {product.description && (
              <AccordionItem value="desc">
                <AccordionTrigger>Дэлгэрэнгүй тайлбар</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">
                  {product.description}
                </AccordionContent>
              </AccordionItem>
            )}
            {product.notesDescription && (
              <AccordionItem value="notes-desc">
                <AccordionTrigger>Үнэрийн нотуудын тайлбар</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">
                  {product.notesDescription}
                </AccordionContent>
              </AccordionItem>
            )}
            {product.usageDescription && (
              <AccordionItem value="usage">
                <AccordionTrigger>Хэрэглэх нөхцөл</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">
                  {product.usageDescription}
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="info">
              <AccordionTrigger>Барааны мэдээлэл</AccordionTrigger>
              <AccordionContent>
                <dl className="space-y-1.5">
                  <Row label="Брэнд" value={product.brand} />
                  <Row label="Төрөл" value={product.concentration} />
                  <Row label="Хүйс" value={GENDER_LABEL[product.gender]} />
                  {product.originCountry && (
                    <Row label="Гарал үүсэл" value={product.originCountry} />
                  )}
                  {product.releaseYear && (
                    <Row
                      label="Гаргасан он"
                      value={String(product.releaseYear)}
                    />
                  )}
                  {familyLabels.length > 0 && (
                    <Row
                      label="Үнэрийн төрөл"
                      value={familyLabels.join(", ")}
                    />
                  )}
                  {product.seasons.length > 0 && (
                    <Row
                      label="Улирал"
                      value={product.seasons
                        .map((s) => SEASON_LABEL[s])
                        .join(", ")}
                    />
                  )}
                </dl>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship">
              <AccordionTrigger>Хүргэлт ба буцаалт</AccordionTrigger>
              <AccordionContent>
                Улаанбаатар хотод 24 цагийн дотор хүргэнэ. Орон нутагт 2-4
                хоног. Decant бараа тул эрүүл ахуйн шалтгаанаар буцаалт
                хийгдэхгүй.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Үнэлгээ */}
          <ReviewSection
            productId={product.id}
            ratingAvg={product.ratingAvg}
            ratingCount={product.ratingCount}
          />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading title="Төстэй бараа" />
          <ProductCarousel products={related} />
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
