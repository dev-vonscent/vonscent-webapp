import { ExtraCard } from "@/features/extras/components/extra-card";
import { Suspense, cache } from "react";
import { preload } from "react-dom";
import type { Metadata } from "next";
import {
  getBestSellers,
  getBrands,
  getCatalog,
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
  newestRail,
  scatterCollections,
  sortSaleRail,
  type RailItem,
} from "@/features/products/rail";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { dailyRandom } from "@/lib/seeded-random";
import {
  HOT_RAIL_COLLECTIONS,
  SALE_RAIL_POOL,
  SITE,
} from "@/lib/constants";
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
import { CampaignHero } from "@/features/marketing/components/home/campaign-hero";
import { resolveHomeHero } from "@/features/marketing/hero-resolve";
import { normalizePromoHref } from "@/features/heroes/lib";
import { HomeShortcuts } from "@/features/marketing/components/home/home-shortcuts";
import { IntentCards } from "@/features/marketing/components/home/intent-cards";
import { ReviewsSection } from "@/features/marketing/components/home/reviews-section";
import {
  CarouselSkeleton,
  MarqueeSkeleton,
  ReviewsSkeleton,
} from "@/components/shared/skeletons";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Nothing waits out this hour:
 *  - admin writes purge it via revalidatePublic();
 *  - orders / cancellations purge stock via revalidateStock();
 *  - timed sales (0166) flip at UB midnight — хямдралын хилийг
 *    `/api/cron/midnight-revalidate` барина.
 * The window is only the safety net for writes that bypass the app.
 */
export const revalidate = 3600;
const homeMetadata = pageMetadata("/");
export const metadata: Metadata = {
  ...homeMetadata,
  openGraph: { ...homeMetadata.openGraph, ...SITE.share },
};

/** Нүүрний rail бүрийн нүдний тоо (гүйлгэдэг carousel). */
const RAIL_SIZE = 12;

/*
 * Request-scoped: several product blocks ask for the same
 * lists, so each list is fetched once per render.
 */
const hotProducts = cache(() => getBestSellers(RAIL_SIZE));

/**
 * Stable: orderable products keep their order and come first, sold-out ones
 * follow — a home row of «Дууссан» cards sells nothing. Nothing is dropped.
 */
function sellableFirst<T extends { soldOut: boolean }>(list: T[]): T[] {
  return [...list.filter((p) => !p.soldOut), ...list.filter((p) => p.soldOut)];
}

/**
 * «Санамсаргүй» холилт бүхэн `dailyRandom` (УБ-ын өдрийн seed) — `Math.random`
 * биш: ISR-ийн дахин үүсгэлт бүрт HTML өөрчлөгдөж Vercel кэшэд бүтэн хуудсыг
 * дахин бичихээс сэргийлнэ. Холилт өдөрт нэг удаа солигдоно.
 *
 * Home — storefront order (2026-10 refresh):
 *   campaign hero → shortcuts → Эрэлттэй → quiz / bundle cards → admin
 *   curated blocks → Шинээр ирсэн → Брэндээр → Тун удахгүй →
 *   reviews → (footer, parallel slot).
 *
 * No 3D runtime is imported here: the old DecantPlayground stays in the
 * codebase but is no longer reachable from this page. Gender / season /
 * family / brand stay as catalog filters, not home sections.
 *
 * Each data block streams behind its own `<Suspense>` with a skeleton of its
 * own shape (no layout shift). The hero alone is awaited up front: it is the
 * LCP, and a nested boundary is revealed late on a busy phone (see
 * `resolveStaticHero`). Its DB read (`live_heroes`, 0184) is one cached RPC;
 * any failure falls back to the code hero (plan §7.1, §7.5).
 */
export default async function HomePage() {
  const hero = await resolveHomeHero();
  return (
    <>
      {/* An overlay with nothing to reserve, so it streams with no fallback. */}
      <Suspense fallback={null}>
        <PromoSlot
          heroHrefs={[
            hero.campaign.primary.href,
            ...(hero.campaign.secondary ? [hero.campaign.secondary.href] : []),
          ]}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SiteJsonLd />
      </Suspense>

      <div className="mx-auto max-w-420 space-y-8 px-4 pt-4 pb-10 sm:space-y-12 sm:pb-14 md:px-8 md:pt-8">
        {/* LCP: hero өөрийн Suspense-гүй (resolveStaticHero-г үз). */}
        <CampaignHero hero={hero} />
        <HomeShortcuts />

        <Suspense fallback={<CarouselSkeleton action />}>
          <BestSellersSection />
        </Suspense>

        <IntentCards />

        {/* Туг хаалттай бол юу ч гаргахгүй (fallback ч үгүй). */}
        <Suspense fallback={null}>
          <SaleSection />
        </Suspense>

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
async function PromoSlot({ heroHrefs }: { heroHrefs: string[] }) {
  const raw = await getPopupSettings();
  // Шийдэгдсэн hero-гийн хоёр товчны холбоос (DB эсвэл кодын, plan §7.2).
  // `/sale/x` ба `/catalog?event=x`, origin, query-ийн дараалал ялгаагүй.
  const taken = new Set(heroHrefs.map(normalizePromoHref));
  const settings = {
    ...raw,
    slides: raw.slides.filter(
      (s) => !s.href || !taken.has(normalizePromoHref(s.href)),
    ),
  };
  // Popup нээгдэхэд түүний зураг LCP болж болно — HTML parse хийх үед
  // JS-тэй зэрэг татаж эхэлнэ. Priority-г өсгөхгүй (hero-той өрсөлдөхгүй).
  const first = firstPopupImage(settings);
  if (first) preload(first, { as: "image" });
  return <PromoPopup settings={settings} />;
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
        items={scatterCollections(
          rail.products,
          rail.collections,
          dailyRandom("home-hot"),
        )}
        prefer={["hot"]}
        // Hero-гийн дараах эхний rail — утсан дээр эхний дэлгэцэнд орж LCP болдог.
        eagerCount={4}
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
            {s.extras.length > 0 ? (
              <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
                {s.extras.map((e) => (
                  <li
                    key={e.id}
                    className="w-[40%] shrink-0 snap-start md:w-auto"
                  >
                    <ExtraCard
                      extra={e}
                      href={`/extras/${e.slug}`}
                      quickAdd
                      showKind
                    />
                  </li>
                ))}
              </ul>
            ) : s.items ? (
              <ProductCarousel items={s.items} prefer={prefer} />
            ) : s.collections.length > 0 ? (
              <ProductCarousel
                items={mixRandom(
                  s.products,
                  s.collections,
                  dailyRandom(`home-section:${s.id}`),
                )}
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
 * «Хямдралтай» (task 2.1, туг `sale_display`) — зөвхөн хямдралтай ДАН ус
 * (бэлэн багц орохгүй; `getCatalog` ус л буцаана). Дуусах мөч ойр → хувь
 * их → ижил бол өдрийн seed-ээр (`sortSaleRail`); хугацаагүй нь ард, дууссан
 * ус хамгийн ард (`sellableFirst`). «Бүгдийг үзэх» → каталог «Бүгд» +
 * «Хямдралтай» таг (багц ч орно, сонгосон эрэмбээр).
 *
 * Өгөгдөл: `catalog_search` (кэш, tag `catalog`/`stock`) + хямдралын товч
 * (`getSaleSummaries`, tag `catalog`) — шинэ кэш/cron үгүй. Хил (УБ 00:00)
 * дээр шөнийн cron цэвэрлэнэ.
 */
async function SaleSection() {
  if (!(await isFeatureEnabled("sale_display"))) return null;
  const { items } = await getCatalog({
    tags: ["sale"],
    sort: "new",
    perPage: SALE_RAIL_POOL,
  });
  const products = sellableFirst(
    sortSaleRail(
      items.filter((p) => p.sale),
      dailyRandom("home-sale"),
    ),
  ).slice(0, RAIL_SIZE);
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="home-sale-title">
      <SectionHeading
        id="home-sale-title"
        compact
        title="Хямдралтай"
        href="/catalog?tags=sale"
      />
      <ProductCarousel products={products} />
    </section>
  );
}

/**
 * Шинээр ирсэн (task 1): ус, бэлэн багц холилдож үүссэн огноогоор буурах
 * (шинэ нь эхэнд), хамгийн ихдээ 12 — 13 дахь нь автоматаар гарна
 * (`newestRail`). Ус нь «Шинэ» тагтай хамгийн сүүлийн 12, багц нь зарагдаж
 * буй хамгийн сүүлийн 12 — нийлүүлээд огноогоор тасална. Дууссан ус тэр 12
 * дотроо ардаа. Нэг мөр дүүрэхгүй бол нуугдана.
 */
async function NewArrivalsSection() {
  const [products, collections] = await Promise.all([
    getNewArrivals(RAIL_SIZE),
    getNewestCollections(RAIL_SIZE),
  ]);
  const items = soldOutLast(newestRail(products, collections, RAIL_SIZE));
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

/** `sellableFirst`-ийн rail хэлбэр — багц энд аль хэдийн зарагдаж буй. */
function soldOutLast(items: RailItem[]): RailItem[] {
  const out = (it: RailItem) => it.kind === "product" && it.product.soldOut;
  return [...items.filter((it) => !out(it)), ...items.filter(out)];
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
