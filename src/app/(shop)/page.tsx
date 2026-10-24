import { Suspense, cache } from "react";
import { preload } from "react-dom";
import type { Metadata } from "next";
import {
  getBestSellers,
  getBrands,
  getComingSoonProducts,
  getNewArrivals,
} from "@/features/products/api";
import { getActiveBrands } from "@/features/taxonomy/api";
import { BrandMarquee } from "@/features/products/components/brand-marquee";
import {
  getPopupSettings,
  getHomeSections,
  getSocialSettings,
} from "@/features/content/api";
import {
  getHotRailCollections,
  getNewestCollections,
} from "@/features/collections/api";
import {
  fillRail,
  mixRandom,
  scatterCollections,
} from "@/features/products/rail";
import { HOT_RAIL_COLLECTIONS, NEW_COLLECTIONS_COUNT } from "@/lib/constants";
import {
  JsonLd,
  homePageJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "@/components/shared/json-ld";
import { pageMetadata } from "@/lib/seo";
import { SectionHeading } from "@/components/shared/section-heading";
import { ProductCarousel } from "@/features/products/components/product-carousel";
import { TopCustomersSection } from "@/features/tiers/components/top-customers-section";
import { PromoPopup } from "@/features/marketing/components/promo-popup";
import { firstPopupImage } from "@/features/marketing/popup-schedule";
import { liveCampaigns } from "@/features/marketing/home-content";
import {
  CampaignHero,
  resolveHero,
  resolveStaticHero,
} from "@/features/marketing/components/home/campaign-hero";
import { HomeShortcuts } from "@/features/marketing/components/home/home-shortcuts";
import { IntentCards } from "@/features/marketing/components/home/intent-cards";
import { ReviewsSection } from "@/features/marketing/components/home/reviews-section";
import {
  HeroSkeleton,
  CarouselSkeleton,
  MarqueeSkeleton,
  ReviewsSkeleton,
} from "@/components/shared/skeletons";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;
export const metadata: Metadata = pageMetadata("/");

/** Нүүрний rail бүрийн нүдний тоо (гүйлгэдэг carousel). */
const RAIL_SIZE = 12;

/*
 * Request-scoped: several product blocks ask for the same
 * lists, so each list is fetched once per render.
 */
const hotProducts = cache(() => getBestSellers(RAIL_SIZE));
const newProducts = cache(async () =>
  sellableFirst(await getNewArrivals(RAIL_SIZE)),
);

/**
 * Stable: orderable products keep their order and come first, sold-out ones
 * follow — a home row of «Дууссан» cards sells nothing. Nothing is dropped.
 */
function sellableFirst<T extends { soldOut: boolean }>(list: T[]): T[] {
  return [...list.filter((p) => !p.soldOut), ...list.filter((p) => p.soldOut)];
}

/**
 * Home — storefront order (2026-10 refresh):
 *   campaign hero → shortcuts → Эрэлттэй → quiz / bundle cards → admin
 *   curated blocks → Шинээр ирсэн → Брэндээр → Тун удахгүй →
 *   reviews → (footer, parallel slot).
 *
 * No 3D runtime is imported here: the old DecantPlayground stays in the
 * codebase but is no longer reachable from this page. Gender / season /
 * family / brand stay as catalog filters, not home sections.
 *
 * The page function is not async: each data block streams behind its own
 * `<Suspense>` with a skeleton of its own shape (no layout shift).
 */
export default function HomePage() {
  const staticHero = resolveStaticHero();
  return (
    <>
      {/* An overlay with nothing to reserve, so it streams with no fallback. */}
      <Suspense fallback={null}>
        <PromoSlot />
      </Suspense>
      <Suspense fallback={null}>
        <SiteJsonLd />
      </Suspense>

      <div className="mx-auto max-w-420 space-y-8 px-4 pt-4 pb-10 sm:space-y-12 sm:pb-14 md:px-8 md:pt-8">
        {/* LCP: статик hero өөрийн Suspense-гүй (resolveStaticHero-г үз). */}
        {staticHero ? (
          <CampaignHero hero={staticHero} />
        ) : (
          <Suspense fallback={<HeroSkeleton />}>
            <HeroSlot />
          </Suspense>
        )}
        <HomeShortcuts />

        <Suspense fallback={<CarouselSkeleton action />}>
          <BestSellersSection />
        </Suspense>

        <IntentCards />

        <Suspense fallback={<CarouselSkeleton action />}>
          <CuratedSections />
        </Suspense>

        <Suspense fallback={<CarouselSkeleton action />}>
          <NewArrivalsSection />
        </Suspense>

        <Suspense fallback={<MarqueeSkeleton />}>
          <BrandsSection />
        </Suspense>

        {/* Ирээгүй ус (0125) — байхгүй үед хэсэг огт гарахгүй. */}
        <Suspense fallback={null}>
          <ComingSoonSection />
        </Suspense>

        <Suspense fallback={<ReviewsSkeleton />}>
          <ReviewsSection />
        </Suspense>

        {/* Top 3 хэрэглэгч (feature flag `user_tiers`). */}
        <Suspense fallback={null}>
          <TopCustomersSection />
        </Suspense>
      </div>
    </>
  );
}

async function SiteJsonLd() {
  const social = await getSocialSettings();
  return (
    <JsonLd
      data={[organizationJsonLd(social), websiteJsonLd(), homePageJsonLd()]}
    />
  );
}

/**
 * The admin popup stays (home only, as before). A slide that links to the
 * same place as the live hero campaign is dropped — the visitor would see
 * the same promotion twice.
 */
async function PromoSlot() {
  const raw = await getPopupSettings();
  const heroHrefs = new Set(liveCampaigns().map((c) => c.primary.href));
  const settings = {
    ...raw,
    slides: raw.slides.filter((s) => !s.href || !heroHrefs.has(s.href)),
  };
  // Popup нээгдэхэд түүний зураг LCP болж болно — HTML parse хийх үед
  // JS-тэй зэрэг татаж эхэлнэ. Priority-г өсгөхгүй (hero-той өрсөлдөхгүй).
  const first = firstPopupImage(settings);
  if (first) preload(first, { as: "image" });
  return <PromoPopup settings={settings} />;
}

async function HeroSlot() {
  return <CampaignHero hero={await resolveHero()} />;
}

/**
 * Эрэлттэй = 12 нүд: 9 ус + 3 багц (клиент, 2026-10). Ус зарагдсан ширхэгээрээ
 * (мл биш) эрэмбээрээ эхнээсээ, дууссан нь ардаа (`sellableFirst`); 3 багц
 * устай өрсөлдөхгүй — нэг нь 2–4 дэх нүдэнд, бусад нь түүнээс хойш санамсаргүй
 * байранд (`scatterCollections`). Зарагдсан багц 3 хүрэхгүй бол бусдаас
 * санамсаргүй нөхнө; багц огт байхгүй бол ус нөхнө.
 */
async function BestSellersSection() {
  const [products, collections] = await Promise.all([
    hotProducts(),
    getHotRailCollections(HOT_RAIL_COLLECTIONS),
  ]);
  const rail = fillRail(
    sellableFirst(products),
    collections,
    RAIL_SIZE,
    HOT_RAIL_COLLECTIONS,
  );
  return (
    <section aria-labelledby="home-hot-title">
      <SectionHeading
        id="home-hot-title"
        compact
        title="Эрэлттэй"
        href="/catalog?tags=hot"
      />
      <ProductCarousel
        items={scatterCollections(rail.products, rail.collections)}
        prefer={["hot"]}
      />
    </section>
  );
}

/**
 * Admin-curated blocks (Админ → Нүүрний хэсгүүд), in the admin's order —
 * e.g. a seasonal «Дулаан, модлог сонголтууд» set. Four products each; the
 * block's own link is its «Бүгдийг үзэх». Nothing is invented when the admin
 * has no section: the block simply isn't there.
 */
async function CuratedSections() {
  const sections = await getHomeSections();
  return (
    <>
      {sections.map((s) => {
        const prefer = s.status ? [s.status] : undefined;
        return (
          <section key={s.id}>
            <SectionHeading
              compact
              title={s.title}
              subtitle={s.subtitle || undefined}
              href={s.href || undefined}
            />
            {/* «Онцлох» (featured) хэсэг ус, багцыг онцлох болгосон
              дарааллаар (`items`); бусад хэсэг админы дарааллаараа. */}
            {s.items ? (
              <ProductCarousel items={s.items} prefer={prefer} />
            ) : s.collections.length > 0 ? (
              <ProductCarousel
                items={mixRandom(s.products, s.collections)}
                prefer={prefer}
              />
            ) : (
              <ProductCarousel products={s.products} prefer={prefer} />
            )}
          </section>
        );
      })}
    </>
  );
}

/**
 * Брэндийн хана — өмнөх нүүрнийх шиг автоматаар урсдаг хоёр мөр; утсан дээр
 * хүрэхэд зогсож, тавихад дахин урсана (`BrandMarquee`). Header-ийн цэсэнд
 * биш энд: брэндийн тоо өсөхөд цэс өндөрсөхгүй.
 */
async function BrandsSection() {
  const [brands, brandLogos] = await Promise.all([
    getBrands(),
    getActiveBrands(),
  ]);
  if (brands.length === 0) return null;
  return (
    <section>
      <SectionHeading compact title="Брэндээр" href="/catalog" />
      <BrandMarquee
        brands={brands}
        logos={Object.fromEntries(brandLogos.map((b) => [b.name, b.logoUrl]))}
      />
    </section>
  );
}

/**
 * Шинээр ирсэн = 9 ус + 3 багц (клиент, 2026-10). Ус үүссэн дарааллаараа
 * (шинэ нь) эхнээсээ, дууссан нь ардаа; хамгийн сүүлийн 3 багц усны дунд
 * санамсаргүй байранд — «Эрэлттэй»-тэй ижил дүрмээр (`scatterCollections`).
 * Багц дутвал ус нөхнө. Нэг мөр дүүрэхгүй бол нуугдана.
 */
async function NewArrivalsSection() {
  const [products, collections] = await Promise.all([
    newProducts(),
    getNewestCollections(NEW_COLLECTIONS_COUNT),
  ]);
  const rail = fillRail(
    products,
    collections,
    RAIL_SIZE,
    NEW_COLLECTIONS_COUNT,
  );
  const items = scatterCollections(rail.products, rail.collections);
  if (items.length < 4) return null;
  return (
    <section>
      <SectionHeading
        compact
        title="Шинээр ирсэн"
        href="/catalog?tags=new&sort=new"
      />
      <ProductCarousel items={items} prefer={["new"]} />
    </section>
  );
}

/**
 * «Тун удахгүй» — урьдчилан оруулсан, хараахан ирээгүй ус (0125). Ганц ус
 * ч байвал гарна: энэ бол «удахгүй юу ирэх вэ» гэсэн мэдээ.
 */
async function ComingSoonSection() {
  const products = await getComingSoonProducts(RAIL_SIZE);
  if (products.length === 0) return null;
  return (
    <section>
      <SectionHeading
        compact
        title="Тун удахгүй"
        subtitle="Ирэхээс нь өмнө танилцаарай"
      />
      <ProductCarousel products={products} />
    </section>
  );
}
