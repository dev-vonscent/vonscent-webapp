import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DeliveryReturnsText } from "@/components/shared/delivery-returns-text";
import { ReviewSection } from "@/features/reviews/components/review-section";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getCollectionBySlug } from "@/features/collections/api";
import { CollectionDetail } from "@/features/collections/components/collection-detail";
import { ProductGallery } from "@/features/products/components/product-gallery";
import type { ProductImage } from "@/lib/types";
import { GENDER_LABEL } from "@/lib/constants";
import { formatDiscountRange } from "@/features/collections/pricing";

export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Багц олдсонгүй" };
  return {
    title: `${collection.name} — Багц`,
    description: collection.description.slice(0, 160),
    // og:image comes from the sibling opengraph-image.tsx file convention.
    ...pageMetadata(`/collections/${collection.slug}`, { ownImage: true }),
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  // Cover + админы сонгосон савны зураг (0123) — савыг барааных шиг бүтнээр.
  const images: ProductImage[] = [];
  if (collection.image)
    images.push({ url: collection.image, alt: collection.name });
  if (collection.bottleImage) {
    images.push({ url: collection.bottleImage, alt: "", contain: true });
  }

  return (
    <div className="mx-auto max-w-352 p-4 sm:py-8 md:px-8">
      <Breadcrumb aria-label="Замын мөр" className="mb-6 hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Нүүр</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/collections">Багц</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{collection.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-6 sm:gap-10 lg:grid-cols-2 lg:items-start">
        {/* Cover */}
        <div className="lg:sticky lg:top-(--header-offset) lg:self-start">
          <div className="relative">
            {images.length > 0 ? (
              <ProductGallery
                images={images}
                name={collection.name}
                bleed={false}
              />
            ) : (
              <div className="border-border bg-muted aspect-square rounded-2xl border" />
            )}
            <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
              {collection.discountRange.max > 0 && (
                <Badge variant="sale" className="w-fit backdrop-blur-sm">
                  −{formatDiscountRange(collection.discountRange)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-muted-foreground text-sm tracking-wide uppercase">
              {GENDER_LABEL[collection.gender]} багц
            </span>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                {collection.name}
              </h1>
              <WishlistButton
                collectionId={collection.id}
                className="bg-secondary hover:bg-accent size-10 shrink-0"
              />
            </div>
          </div>

          <CollectionDetail collection={collection} />

          {/* Дан усных шиг accordion (клиент, 2026-09 UG; 0106). Тайлбар нь
              өмнө нь хэмжээний доор эвхэгддэг догол мөр байсан — одоо
              «Дэлгэрэнгүй тайлбар». Хоосон хэсэг нээгдэхгүй, харин
              «Хүргэлт ба буцаалт» нь бүх барааны нийтлэг текст тул үргэлж. */}
          <Accordion
            type="single"
            collapsible
            defaultValue={collection.description ? "desc" : undefined}
          >
            {collection.description && (
              <AccordionItem value="desc">
                <AccordionTrigger>Дэлгэрэнгүй тайлбар</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">
                  {collection.description}
                </AccordionContent>
              </AccordionItem>
            )}
            {collection.usageDescription && (
              <AccordionItem value="usage">
                <AccordionTrigger>Хэрэглэх нөхцөл</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">
                  {collection.usageDescription}
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="ship">
              <AccordionTrigger>Хүргэлт ба буцаалт</AccordionTrigger>
              <AccordionContent>
                <DeliveryReturnsText />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Үнэлгээ — барааны хуудастай ижил, бүтэн өргөнөөр (0107). */}
      <section className="mt-16">
        <ReviewSection
          target={{ kind: "collection", id: collection.id }}
          path={`/collections/${collection.slug}`}
          ratingAvg={collection.ratingAvg}
        />
      </section>
    </div>
  );
}
