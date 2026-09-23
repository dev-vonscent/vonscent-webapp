import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, ArrowRight, Quote } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { Stars } from "@/components/shared/stars";
import { ProductCarousel } from "@/features/products/components/product-carousel";
import { BrandMarquee } from "@/features/products/components/brand-marquee";
import {
  getNewArrivals,
  getBestSellers,
  getOnSale,
  getBrands,
} from "@/features/products/api";
import { getRecentReviews } from "@/features/reviews/api";
import { getPopupSettings, getHomeSections } from "@/features/content/api";
import { getActiveBrands, getScentFamilies } from "@/features/taxonomy/api";
import { getFeaturedCollections } from "@/features/collections/api";
import { CollectionCard } from "@/features/collections/components/collection-card";
import { ScentQuiz } from "@/features/quiz/components/scent-quiz";
import { PromoPopup } from "@/features/marketing/components/promo-popup";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";
import { GRAIN } from "@/lib/textures";
import { SideImage } from "@/components/shared/side-image";
import {
  CarouselSkeleton,
  CollectionGridSkeleton,
  MarqueeSkeleton,
  ReviewsSkeleton,
  TileGridSkeleton,
} from "@/components/shared/skeletons";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

/**
 * The page function itself is deliberately **not** async: nothing above blocks
 * on the database, so the hero, the trust strip and the static category grids
 * paint the instant the document arrives. Every data-backed rail is its own
 * async component behind a `<Suspense>` boundary and streams in under a
 * skeleton of its own shape.
 *
 * That is why each rail re-fetches what it needs instead of taking props from
 * one big `Promise.all`: the underlying readers (`fetchProducts`,
 * `fetchSettings`, `fetchScentFamilies`, `fetchBrands`, `getBaseCollections`)
 * are all wrapped in React `cache()`, so a request still makes each query once
 * — the boundaries only change *when* each result is allowed to paint, not how
 * many round-trips there are.
 */

export default function HomePage() {
  return (
    <>
      {/* An overlay with nothing to reserve, so it streams with no fallback. */}
      <Suspense fallback={null}>
        <PromoSlot />
      </Suspense>

      {/* Hero — a full-bleed banner. The artwork keeps its own 1672×941 ratio
          (`w-full h-auto`), so it is never cropped: the whole shot is visible
          edge to edge at every width. Pulled up under the floating header
          (pt-4 16px + h-14 pill = 72px) so it reaches the very top and shows
          behind the translucent pill. */}
      <section className="bg-background relative -mt-18 w-full overflow-hidden">
        {/* Two art directions, three palettes. The breakpoint is handled by
            the wrappers and the palette by the images inside them, so neither
            rule has to be stacked onto the other.

            Palette swapping is CSS, never a theme read in JS: the right shot
            is painted on the first frame, with no post-hydration flash. The
            shot's empty area IS the theme backdrop (black / white / blush),
            so the copy laid over it just follows the theme tokens. A
            display:none image is never "visible", so lazy-loading would never
            fire it — hence `loading="eager"` on every alternate. */}

        {/* Phone: a 650×941 portrait crop — the wide shot's bottle would be
            thumbnail-sized at this width, and its empty left half (built to
            hold the copy) collapses to nothing. Here the copy sits below. */}
        <div className="md:hidden">
          <Image
            src="/hero-mobile-black.png"
            alt="VON SCENT"
            width={650}
            height={861}
            priority
            sizes="100vw"
            className="block h-auto w-full in-[.pink]:hidden in-[.white]:hidden"
          />
          <Image
            src="/hero-mobile-white.png"
            alt="VON SCENT"
            width={650}
            height={861}
            loading="eager"
            sizes="100vw"
            className="hidden h-auto w-full in-[.white]:block"
          />
          <Image
            src="/hero-mobile-pink.png"
            alt="VON SCENT"
            width={650}
            height={861}
            loading="eager"
            sizes="100vw"
            className="hidden h-auto w-full in-[.pink]:block"
          />
        </div>

        {/* md and up: the 1672×941 banner, whose left 60% is the copy well. */}
        <div className="hidden md:block">
          <Image
            src="/hero-blackv1.png"
            alt="VON SCENT"
            width={1672}
            height={941}
            priority
            sizes="100vw"
            className="block h-auto w-full in-[.pink]:hidden in-[.white]:hidden"
          />
          <Image
            src="/hero-whitev1.png"
            alt="VON SCENT"
            width={1672}
            height={941}
            loading="eager"
            sizes="100vw"
            className="hidden h-auto w-full in-[.white]:block"
          />
          <Image
            src="/hero-pinkv1.png"
            alt="VON SCENT"
            width={1672}
            height={941}
            loading="eager"
            sizes="100vw"
            className="hidden h-auto w-full in-[.pink]:block"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />

        {/* Copy. From md up it is absolutely positioned over the empty left
            half of the artwork; on phones that half is only ~200px tall, so
            the block drops back into flow under the banner. Either way it sits
            on the theme's own backdrop colour, so the plain tokens are legible
            in all three palettes. */}
        <div className="md:absolute md:inset-0">
          <div className="mx-auto flex h-full max-w-352 items-center px-4 pt-8 pb-12 md:px-8 md:py-0">
            <div className="max-w-xl space-y-5 max-md:mx-auto max-md:flex max-md:flex-col max-md:items-center max-md:text-center md:space-y-6">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.22em] uppercase sm:text-sm">
                Оригинал үнэртэн · Decant
              </p>
              <h1 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Бүтэн савтай үнэртэн авахаасаа өмнө туршаад үзээрэй
              </h1>
              <p className="text-muted-foreground text-base text-pretty sm:text-lg">
                Дэлхийн шилдэг үнэртнүүдийг 2/5/10/20 мл хэмжээгээр
              </p>
              <div className="flex gap-3">
                <Button
                  asChild
                  size="lg"
                  className="in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
                >
                  <Link href="/catalog">Каталог үзэх</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="in-[.black]:bg-white/10 in-[.black]:text-white in-[.black]:hover:bg-white/20"
                >
                  <Link href="/collections/build">Багц угсрах</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-352 space-y-10 px-4 py-8 sm:space-y-16 sm:py-14 md:px-8">
        {/* Админы угсарсан rail-ууд («Онцлох», «Багц уснууд») эхэнд —
            «Шинээр буусан» тэдний оронд доошоо шилжсэн. */}
        <Suspense fallback={<CarouselSkeleton action />}>
          <CuratedSections />
        </Suspense>

        <QuizSection />

        <Suspense fallback={<CarouselSkeleton action />}>
          <BestSellersSection />
        </Suspense>

        <Suspense fallback={<CollectionGridSkeleton />}>
          <FeaturedBundlesSection />
        </Suspense>

        {/* Build-your-own bundle promo — the side image (5c) bleeds to the
            card edge and fades into the bg-card surface; a CSS glow stands
            in until public/bundle-side.webp is generated. */}
        <section className="force-black border-border bg-card relative grid grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-[320px_1fr]">
          <SideImage
            src="/bundle-side.webp"
            sizes="(max-width: 768px) 100vw, 320px"
            className="relative order-first aspect-5/2 min-h-70 w-full md:order-0 md:aspect-auto md:min-h-0"
            fallbackClassName="bg-[radial-gradient(ellipse_65%_70%_at_35%_55%,rgba(88,92,104,.45),rgba(40,42,50,.18)_55%,transparent_80%)]"
          >
            {/* fade into the card surface — md+ only; on mobile the image keeps
                its full-bleed edge (a vertical fade washed it out in light mode) */}
            <div className="from-card absolute inset-y-0 right-0 hidden w-1/2 bg-linear-to-l to-transparent md:block" />
          </SideImage>
          <div className="flex max-w-xl min-w-0 flex-col items-start justify-center gap-4 p-6 sm:p-10">
            <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
              Өөрийн багц
            </p>
            <h2 className="font-serif text-2xl font-semibold text-balance wrap-break-word sm:text-3xl">
              Дуртай үнэртнүүдээ багцал
            </h2>
            <p className="text-muted-foreground">
              4 ба түүнээс дээш үнэртэн сонгоод хямдралтай үнээр аваарай — Өөрт
              таалагдсан хослолоо хүссэнээрээ бүрдүүл.
            </p>
            <Button asChild size="lg">
              <Link href="/collections/build">
                Багц угсарч эхлэх <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <Suspense fallback={<CarouselSkeleton action />}>
          <NewArrivalsSection />
        </Suspense>

        {/* Shop by gender */}
        <section>
          <SectionHeading title="Хүйсээр" />
          <div className="grid grid-cols-3 gap-4">
            {GENDERS.map((g, i) => (
              <Link
                key={g}
                href={`/catalog?gender=${g}`}
                className="group bg-secondary hover:shadow-lift relative flex aspect-3/4 flex-col justify-end overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 sm:aspect-3/2"
              >
                <Image
                  src={`/gender-${g}.webp`}
                  alt={GENDER_LABEL[g]}
                  fill
                  sizes="(max-width: 640px) 33vw, 360px"
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/15" />
                <span
                  aria-hidden
                  className="absolute top-4 right-4 z-10 font-serif text-3xl text-white/40"
                >
                  0{i + 1}
                </span>
                <span className="relative z-10 font-serif text-lg font-medium text-white sm:text-xl">
                  {GENDER_LABEL[g]}
                </span>
                <span className="relative z-10 mt-1 inline-flex items-center gap-1 text-xs text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                  Үзэх <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Suspense fallback={<TileGridSkeleton />}>
          <ScentFamiliesSection />
        </Suspense>

        {/* Shop by season */}
        <section>
          <SectionHeading title="Улирлаар" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { slug: "spring", label: "Хавар", ext: "jpg" },
              { slug: "summer", label: "Зун", ext: "jpg" },
              { slug: "autumn", label: "Намар", ext: "jpg" },
              { slug: "winter", label: "Өвөл", ext: "jpg" },
              { slug: "all", label: "Бүх улирал", ext: "webp" },
            ].map((s) => (
              <Link
                key={s.slug}
                href={`/catalog?season=${s.slug}`}
                className="group bg-secondary hover:shadow-lift relative flex aspect-3/2 items-end overflow-hidden rounded-2xl p-4 transition-all last:col-span-2 hover:-translate-y-1 sm:last:col-span-1"
              >
                <Image
                  src={`/season-${s.slug}.${s.ext}`}
                  alt={s.label}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/5" />
                <span className="relative z-10 font-serif text-lg font-medium text-white">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Suspense fallback={<MarqueeSkeleton />}>
          <BrandsSection />
        </Suspense>

        <Suspense fallback={<CarouselSkeleton action />}>
          <OnSaleSection />
        </Suspense>

        <Suspense fallback={<ReviewsSkeleton />}>
          <ReviewsSection />
        </Suspense>
      </div>
    </>
  );
}

async function PromoSlot() {
  return <PromoPopup settings={await getPopupSettings()} />;
}

/** Шинээр буусан — hidden until it can fill a row (5d). */
async function NewArrivalsSection() {
  const products = await getNewArrivals(8);
  if (products.length < 4) return null;
  return (
    <section>
      <SectionHeading title="Шинээр буусан" href="/catalog?tags=new" />
      <ProductCarousel products={products} />
    </section>
  );
}

/**
 * Scent quiz — for visitors who can't pick. Entirely client-side (so the ISR
 * page stays cacheable) and no longer fetches anything on the server, so it
 * needs no Suspense boundary: matching runs in /api/quiz on demand.
 */
function QuizSection() {
  return (
    <section>
      <ScentQuiz />
    </section>
  );
}

async function BestSellersSection() {
  return (
    <section>
      <SectionHeading title="Эрэлттэй" href="/catalog?tags=hot" />
      <ProductCarousel products={await getBestSellers(8)} />
    </section>
  );
}

async function FeaturedBundlesSection() {
  const collections = await getFeaturedCollections(3);
  if (collections.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Онцлох багц"
        subtitle="Сонгож бэлдсэн үнэртний багцууд"
        href="/collections"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {collections.map((c) => (
          <CollectionCard key={c.id} collection={c} />
        ))}
      </div>
    </section>
  );
}

/**
 * Curated rails — «Онцлох», «Багц уснууд» and anything else the admin composed
 * (todo.md B7), in the order they set. They share one boundary because they are
 * one query and their count isn't known until it resolves.
 */
async function CuratedSections() {
  const sections = await getHomeSections();
  return (
    <>
      {sections.map((s) => (
        <section key={s.id}>
          <SectionHeading title={s.title} href={s.href || undefined} />
          <ProductCarousel products={s.products} />
        </section>
      ))}
    </>
  );
}

/**
 * Shop by scent family — the admin-managed taxonomy, icons included
 * (todo.md B3b), so a family added in the admin shows up here too.
 */
async function ScentFamiliesSection() {
  const families = await getScentFamilies();
  if (families.length === 0) return null;
  return (
    <section>
      <SectionHeading title="Үнэрийн төрлөөр" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {families.map((f) => (
          <Link
            key={f.slug}
            href={`/catalog?family=${f.slug}`}
            className="group bg-card hover:bg-accent hover:shadow-soft flex flex-col items-center gap-2 rounded-xl p-4 text-center text-xs font-medium transition-all hover:-translate-y-1"
          >
            <div className="relative size-16 transition-transform duration-500 group-hover:scale-105">
              {f.iconUrl ? (
                <Image
                  src={f.iconUrl}
                  alt={f.label}
                  fill
                  sizes="64px"
                  // The 256px WebP master is only a few KB; optimizing it
                  // would cost a transformation without shrinking much.
                  unoptimized
                  className="object-contain"
                />
              ) : (
                // No icon uploaded yet: the initial keeps the grid even.
                <span className="bg-secondary flex size-full items-center justify-center rounded-full font-serif text-xl">
                  {f.label.slice(0, 1)}
                </span>
              )}
            </div>
            {f.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

async function BrandsSection() {
  const [brands, brandLogos] = await Promise.all([
    getBrands(),
    getActiveBrands(),
  ]);
  return (
    <section>
      <SectionHeading title="Брэндээр" href="/catalog" />
      <BrandMarquee
        brands={brands}
        logos={Object.fromEntries(brandLogos.map((b) => [b.name, b.logoUrl]))}
      />
    </section>
  );
}

async function OnSaleSection() {
  const onSale = await getOnSale(4);
  if (onSale.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Онцгой санал"
        subtitle="Хямдралтай үнэртнүүд"
        href="/catalog?tags=sale"
      />
      <ProductCarousel products={onSale} />
    </section>
  );
}

async function ReviewsSection() {
  const reviews = await getRecentReviews(3);
  if (reviews.length === 0) return null;
  return (
    <section>
      <SectionHeading
        title="Хэрэглэгчдийн сэтгэгдэл"
        subtitle="Бодит худалдан авагчдын үнэлгээ"
      />
      <div className="grid gap-5 md:grid-cols-3">
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="group border-border bg-card hover:border-gold-strong/40 hover:shadow-lift relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 transition-all duration-300"
          >
            <Quote
              className="text-foreground/4 group-hover:text-gold-strong/10 pointer-events-none absolute -top-3 -right-3 size-20 rotate-180 transition-colors"
              strokeWidth={1.5}
              aria-hidden
            />
            <Stars rating={r.rating} size={16} />
            <blockquote className="text-foreground/90 line-clamp-5 font-serif text-[15px] leading-relaxed">
              “{r.body || "Сайхан үнэр!"}”
            </blockquote>
            <figcaption className="border-border/60 mt-auto flex items-center gap-3 border-t pt-4">
              <span className="bg-secondary relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold">
                {r.authorAvatar ? (
                  <Image
                    src={r.authorAvatar}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  r.authorName.charAt(0).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-foreground truncate text-sm font-medium">
                    {r.authorName}
                  </span>
                  <BadgeCheck
                    className="text-gold-strong size-3.5 shrink-0"
                    aria-label="Баталгаажсан худалдан авагч"
                  />
                </div>
                <span className="text-muted-foreground block text-xs">
                  {formatDate(r.createdAt)}
                </span>
              </div>
              {r.productName && (
                <Link
                  href={`/products/${r.productSlug}`}
                  className="group/prod flex items-center gap-2"
                  title={`${r.brand} ${r.productName}`}
                >
                  <span className="border-border bg-muted group-hover/prod:border-gold-strong/50 relative size-15 shrink-0 overflow-hidden rounded-lg border transition-colors">
                    {r.productImage ? (
                      <Image
                        src={r.productImage}
                        alt={r.productName}
                        fill
                        sizes="60px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground flex h-full items-center justify-center text-[10px] font-medium">
                        {r.brand.charAt(0)}
                      </span>
                    )}
                  </span>
                </Link>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
