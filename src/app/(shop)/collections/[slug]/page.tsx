import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { GenderBadge } from "@/features/products/components/gender-badge";
import { notFound } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DeliveryText,
  ReturnsText,
} from "@/components/shared/delivery-returns-text";
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
import { CollectionSaleBadge } from "@/features/sale-events/components/collection-sale-badge";
import { CollectionDetail } from "@/features/collections/components/collection-detail";
import { ProductGallery } from "@/features/products/components/product-gallery";
import { TrackViewItem } from "@/features/products/components/track-view-item";
import type { ProductImage } from "@/lib/types";

/**
 * ISR — admin writes, orders (revalidateStock) and the sale-boundary cron
 * purge it; хямдралын хилийг `/api/cron/midnight-revalidate` барина.
 */
export const revalidate = 3600;

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
    description: collection.description.slice(0, 160),
    // og:image comes from the sibling opengraph-image.tsx file convention.
    ...pageMetadata(`/collections/${collection.slug}`, {
      title: `${collection.name} — Багц`,
      ownImage: true,
    }),
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

      <div className="grid grid-cols-1 gap-0 max-sm:block sm:gap-10 lg:grid-cols-2 lg:items-start">
        {/* Cover — барааны хуудастай ижил: утсан дээр толгойн доогуур бүтэн
            өргөнөөр (bleed), desktop-д хүрээтэй. */}
        {/* Утсан дээр зураг байрандаа (sticky top-0) үлдэж, доорх самбар
            түүний дээгүүр гулсаж гарна. Grid item-ийн sticky нь өөрийн
            мөрөөсөө гарахгүй тул < sm үед grid биш block (`max-sm:block`) —
            тэгвэл зураг бүх grid-ийн туршид наалдана. */}
        <div className="max-sm:sticky max-sm:top-0 lg:sticky lg:top-(--header-offset) lg:self-start">
          {images.length > 0 ? (
            <ProductGallery images={images} name={collection.name} />
          ) : (
            <div className="border-border bg-muted -mx-4 -mt-20 aspect-square border sm:mx-0 sm:mt-0 sm:rounded-2xl" />
          )}
        </div>

        {/* Барааны хуудас шиг: утсан дээр самбар зургийн доод хэсгийг дугуй
            оройгоор давхарлана; sm+-д энгийн багана. */}
        <div className="bg-background relative z-10 -mx-4 -mt-8 space-y-6 rounded-t-4xl px-4 pt-8 sm:mx-0 sm:mt-0 sm:rounded-none sm:bg-transparent sm:px-0 sm:pt-0">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm tracking-wide uppercase">
                Багц
              </span>
              {/* Арга хэмжээний chip — барааны хуудастай ижил байрлал (нэрийн
                  дээрх мөр, event-ийн өнгө, туг sale_event_bundles). */}
              <CollectionSaleBadge collection={collection} surface="detail" />
              {/* Хүйс — барааны хуудас шиг chip. */}
              <GenderBadge gender={collection.gender} />
            </div>
            <div className="flex items-start justify-between gap-3">
              {/* Нэр үнээс (SizePrice lg, 32/36px) жижиг — нүд эхлээд үнэ дээр. */}
              <h1 className="font-serif text-2xl font-semibold tracking-tight">
                {collection.name}
              </h1>
              <WishlistButton
                collectionId={collection.id}
                className="bg-secondary hover:bg-accent size-10 shrink-0"
              />
            </div>
          </div>

          <CollectionDetail collection={collection} />
          {/* Барааны хуудсын адил ViewContent — багц үзсэн зочин ч retargeting
              audience-д орно. */}
          <TrackViewItem
            id={collection.id}
            name={collection.name}
            brand="vonscent"
            price={collection.startingPrice}
          />

          {/* Дан усных шиг accordion (клиент, 2026-09 UG; 0106). Тайлбар нь
              өмнө нь хэмжээний доор эвхэгддэг догол мөр байсан — одоо
              «Дэлгэрэнгүй тайлбар». Хоосон хэсэг нээгдэхгүй, харин
              «Хүргэлт», «Буцаалт» нь бүх барааны нийтлэг текст тул үргэлж. */}
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
            {/* «Хүргэлт» ба «Буцаалт» тусдаа (task 5). */}
            <AccordionItem value="ship">
              <AccordionTrigger>Хүргэлт</AccordionTrigger>
              <AccordionContent>
                <DeliveryText />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="returns">
              <AccordionTrigger>Буцаалт</AccordionTrigger>
              <AccordionContent>
                <ReturnsText />
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
