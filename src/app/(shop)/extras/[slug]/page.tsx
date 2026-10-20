import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DeliveryReturnsText } from "@/components/shared/delivery-returns-text";
import { JsonLd, breadcrumbJsonLd } from "@/components/shared/json-ld";
import { ProductGallery } from "@/features/products/components/product-gallery";
import { getShopExtra, getShopExtras } from "@/features/extras/api";
import { ExtraCard } from "@/features/extras/components/extra-card";
import { ExtraPurchase } from "@/features/extras/components/extra-purchase";
import { bottleSizeText } from "@/features/extras/lib/display";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { formatPrice } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

/** ISR — үнэртний хуудастай ижил (cookie-гүй client, revalidatePublic). */
export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!(await isFeatureEnabled("extras_shop"))) return {};
  const { slug } = await params;
  const extra = await getShopExtra(slug);
  if (!extra) return { title: "Бараа олдсонгүй" };
  const { card } = extra;
  return {
    title: card.leftover
      ? `${card.name} — ${card.leftover.brand}`
      : `${card.name} — ${card.categoryName}`,
    description: (
      extra.description ||
      `${card.categoryName} — ${formatPrice(card.fromPrice)}-өөс. vonscent.mn`
    ).slice(0, 160),
    ...pageMetadata(`/extras/${card.slug}`),
  };
}

/**
 * Нэмэлт барааны хуудас (extras-shop-plan §9): галерей, хувилбар, үнэ,
 * «Сагсанд нэмэх». Үлдэгдэлтэй шил нь ганц ширхэг — эх үнэртний хуудас руу
 * холбоостой. Туг `extras_shop` хаалттай бол 404.
 */
export default async function ExtraPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { slug } = await params;
  const [extra, all] = await Promise.all([getShopExtra(slug), getShopExtras()]);
  if (!extra) notFound();
  const { card } = extra;
  const leftover = card.leftover;
  const size = bottleSizeText(card);
  const perMl =
    leftover && leftover.remainingMl > 0
      ? Math.round(card.fromPrice / leftover.remainingMl)
      : null;
  // «Хамт авдаг»: бусад ангиллын, одоо зарагдаж буй бараа.
  const together = all
    .filter((e) => e.categorySlug !== card.categorySlug && !e.soldOut)
    .slice(0, 4);
  const catalogHref = `/catalog?tab=extras&cat=${card.categorySlug}`;

  return (
    <div className="mx-auto max-w-352 p-4 sm:py-8 md:px-8">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Нүүр", path: "" },
            { name: "Нэмэлт бараа", path: "/catalog?tab=extras" },
            { name: card.name, path: `/extras/${card.slug}` },
          ]),
        ]}
      />
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
              <Link href={catalogHref}>{card.categoryName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{card.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 gap-0 sm:gap-10 lg:grid-cols-2 lg:items-start">
        <div className="lg:sticky lg:top-(--header-offset) lg:self-start lg:transition-[top] lg:duration-300 lg:ease-out">
          <ProductGallery
            images={extra.images.map((url) => ({ url, alt: card.name }))}
            name={card.name}
          />
        </div>

        <div className="bg-background relative z-10 -mx-4 -mt-8 space-y-10 rounded-t-4xl px-4 pt-8 sm:mx-0 sm:mt-0 sm:rounded-none sm:bg-transparent sm:px-0 sm:pt-0">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm tracking-wide uppercase">
                  {leftover ? leftover.brand : card.categoryName}
                </span>
                {leftover && !card.soldOut && (
                  <Badge variant="gold">Ганц ширхэг</Badge>
                )}
              </div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                {card.name}
              </h1>
              {leftover && (
                <p className="text-muted-foreground text-sm tabular-nums">
                  ≈{leftover.remainingMl} / {leftover.fullMl}ml
                  {perMl != null && ` · 1ml ≈ ${formatPrice(perMl)}`}
                </p>
              )}
              {size && (
                <p className="text-muted-foreground text-sm tabular-nums">
                  Хэмжээ: {size}
                </p>
              )}
            </div>

            <ExtraPurchase extra={extra} />

            {leftover && !card.soldOut && (
              <p className="bg-secondary rounded-lg px-4 py-3 text-sm">
                Энэ бол декант цутгадаг эх шил өөрөө. Ганц ширхэг тул захиалсан
                даруй хаагдана.
              </p>
            )}
            {leftover && extra.productSlug && (
              <Link
                href={`/products/${extra.productSlug}`}
                className="text-sm underline-offset-4 hover:underline"
              >
                {leftover.productName} — декантаар авах
              </Link>
            )}
          </div>

          {extra.description && (
            <div>
              <h2 className="mb-3 font-serif text-xl font-semibold">Тайлбар</h2>
              <p className="text-muted-foreground text-sm/relaxed whitespace-pre-line">
                {extra.description}
              </p>
            </div>
          )}

          <div>
            <h2 className="mb-3 font-serif text-xl font-semibold">Хүргэлт</h2>
            <p className="text-muted-foreground text-sm/relaxed">
              <DeliveryReturnsText />
            </p>
          </div>
        </div>
      </div>

      {together.length > 0 && (
        <section aria-labelledby="extras-together" className="mt-16 space-y-4">
          <h2
            id="extras-together"
            className="font-serif text-2xl font-semibold tracking-tight"
          >
            Хамт авдаг
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">
            {together.map((e) => (
              <li key={e.id}>
                <ExtraCard extra={e} href={`/extras/${e.slug}`} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
