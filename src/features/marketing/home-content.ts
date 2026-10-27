/**
 * Нүүр хуудасны редакцын агуулга — НЭГ эх сурвалж.
 *
 * Улирлын кампанит hero болон hero-гийн доорх 4 товчлолыг эндээс л засна;
 * компонентууд текст, зураг, холбоосоо hardcode хийхгүй. Одоогоор админы
 * засварлах UI байхгүй (settings-д `hero` түлхүүр нэмэх нь дараагийн алхам —
 * migration шаардлагагүй, key/value хүснэгт).
 *
 * Дүрэм:
 *  - Хүргэлтийн босго, хямдрал, урамшууллын амлалт ЭНД бичихгүй — тэдгээр
 *    нь бодит тохиргооноос (settings) ирэх ёстой.
 *  - Мл нь барааны хувилбар — `?ml=` холбоос хэрэглэхгүй.
 */

export interface HomeCampaignLink {
  label: string;
  href: string;
}

export type HomeCampaignImage =
  /** Админы оруулсан багцын cover зураг (slug-аар). Олдохгүй бол evergreen. */
  | { kind: "collection"; slug: string; alt: string; position?: string }
  /**
   * `public/` доорх статик файл. `mobile` өгвөл утсан дээр (< md) тэр зураг
   * гарна (art direction) — зургийн хоосон хэсэгт текст давхарлана.
   */
  | {
      kind: "static";
      src: string;
      width: number;
      height: number;
      alt: string;
      position?: string;
      /**
       * Бэлэн хэмжээнүүд (`"/a-1600.webp 1600w, …"`) — Next optimizer-ыг
       * алгасна. `deviceSizes` 1600-аар хязгаарлагдсан тул retina өргөн
       * дэлгэцэд hero-г 2× сунгадаг байсан.
       */
      srcSet?: string;
      mobile?: { src: string; width: number; height: number };
      /** Зургийн (desktop, утас хоёулаа) хана бараан — текст цайвар болно. */
      dark?: boolean;
    };

/**
 * Hero-гийн гэрэл зураг: зүүн тал (desktop) / дээд хэсэг (утас) нь хоосон
 * цайвар хана — текст тэнд сууна. Эх нь `public/desktop.webp` (3584×1280,
 * шууд 2.8:1 — prompts/hero-desktop.md), `mobile.png`.
 */
const HERO_PHOTO: HomeCampaignImage = {
  kind: "static",
  src: "/hero-desktop-v4-1600.webp",
  width: 1600,
  height: 571,
  srcSet: [1600, 2400, 3200]
    .map((w) => `/hero-desktop-v4-${w}.webp ${w}w`)
    .join(", "),
  alt: "Armani Stronger With You Intensely, Parfums de Marly Layton, Azzaro The Most Wanted Parfum болон decant савнууд",
  // Зургийг солихдоо файлын НЭРИЙГ ч соль: ижил URL-д Next-ийн зургийн кэш
  // (.next/cache/images, Vercel CDN) болон Safari хуучин зургийг өгсөөр байдаг.
  mobile: { src: "/hero-mobile-v4.webp", width: 1600, height: 1200 },
};

/**
 * Halloween (prompts/hero-halloween.md, B — шөнийн бараан). Эх нь
 * `public/desktop-halloween-dark.webp`, `mobile-halloween.webp`.
 */
const HALLOWEEN_PHOTO: HomeCampaignImage = {
  ...HERO_PHOTO,
  src: "/hero-desktop-halloween-dark-1600.webp",
  srcSet: [1600, 2400, 3200]
    .map((w) => `/hero-desktop-halloween-dark-${w}.webp ${w}w`)
    .join(", "),
  mobile: { src: "/hero-mobile-halloween.webp", width: 1600, height: 1200 },
  dark: true,
};

export interface HomeCampaign {
  id: string;
  /** Улаанбаатарын огноо `YYYY-MM-DD`, хоёулаа хамааруулна. null = хязгааргүй. */
  startsOn: string | null;
  endsOn: string | null;
  eyebrow: string;
  title: string;
  description: string;
  /** Утсан дээрх богино тайлбар; байхгүй бол `description`. */
  mobileDescription?: string;
  primary: HomeCampaignLink;
  secondary?: HomeCampaignLink;
  image: HomeCampaignImage;
}

/**
 * Хуваарьтай кампанит ажлууд — эхнийх нь (хугацаандаа байгаа) гарна. Шинэ
 * улирал = энд нэг мөр нэмэх; дизайн өөрчлөгдөхгүй.
 */
export const HOME_CAMPAIGNS: readonly HomeCampaign[] = [
  {
    id: "2026-halloween",
    startsOn: "2026-10-26",
    endsOn: "2026-10-31",
    eyebrow: "Энэ улирлын сонголт",
    title: "Өвлийн тансаг үнэртнүүд",
    description:
      "Өвөлд тохирох үнэртнүүдийг бүтнээр нь авалгүй хямд өртгөөр туршаад үзээрэй.",
    mobileDescription: "Бүтнээр нь авалгүй хямд өртгөөр туршаарай.",
    // Текст нь cold-season-тэй ижил — зөвхөн зураг солигдоно.
    primary: {
      label: "Сонголтыг үзэх",
      href: "/catalog?kind=perfume&season=winter",
    },
    secondary: { label: "Бүх үнэртэн", href: "/catalog" },
    image: HALLOWEEN_PHOTO,
  },
  {
    id: "2026-cold-season",
    startsOn: "2026-09-15",
    endsOn: "2027-02-28",
    eyebrow: "Энэ улирлын сонголт",
    title: "Өвлийн тансаг үнэртнүүд",
    description:
      "Өвөлд тохирох үнэртнүүдийг бүтнээр нь авалгүй хямд өртгөөр туршаад үзээрэй.",
    mobileDescription: "Бүтнээр нь авалгүй хямд өртгөөр туршаарай.",
    // Дан ус + өвөл: бараг бүх өвлийн ус «намар+өвөл» тагтай тул «өвөл»
    // дангаараа хангалттай; багцад улирал байхгүй (клиент, 2026-10-26).
    primary: {
      label: "Сонголтыг үзэх",
      href: "/catalog?kind=perfume&season=winter",
    },
    secondary: { label: "Бүх үнэртэн", href: "/catalog" },
    image: HERO_PHOTO,
  },
];

/** Хугацаандаа кампанит ажил байхгүй үеийн байнгын hero. */
export const EVERGREEN_HERO: HomeCampaign = {
  id: "evergreen",
  startsOn: null,
  endsOn: null,
  eyebrow: "Оригинал үнэртэн · Decant",
  title: "Бүтэн сав авахаасаа өмнө туршаад үзээрэй",
  description:
    "Дэлхийн үнэртнүүдийг 2, 5, 10, 20 мл хэмжээгээр — өөрт тохирохоо олоод дараа нь бүтнээр нь аваарай.",
  mobileDescription: "Үнэртнүүдийг 2, 5, 10, 20 мл хэмжээгээр.",
  primary: { label: "Каталог үзэх", href: "/catalog" },
  secondary: { label: "Багц үүсгэх", href: "/collections/build" },
  image: HERO_PHOTO,
};

/** Улаанбаатарын өнөөдрийн огноо `YYYY-MM-DD`. */
export function ubToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
  }).format(now);
}

export function liveCampaigns(
  now: Date = new Date(),
  campaigns: readonly HomeCampaign[] = HOME_CAMPAIGNS,
): HomeCampaign[] {
  const today = ubToday(now);
  return campaigns.filter(
    (c) =>
      (!c.startsOn || c.startsOn <= today) && (!c.endsOn || today <= c.endsOn),
  );
}
