import type { FeatureFlag } from "@/lib/constants";

/**
 * Storefront navigation — one list for the desktop header row and the mobile
 * drawer, so the two never disagree.
 *
 * An entry with `menu` opens a dropdown panel on desktop instead of being a
 * plain link; the panel's content is rendered on the server and handed to the
 * header by key (see `SiteHeader`'s `menus` prop). The drawer still links
 * straight to `href`.
 *
 * An entry with `flag` shows only while that feature flag is on — «Үнэртний
 * шил», «Дагалдах хэрэгсэл» (`extras_shop`) must not lead to a 404 (the pages
 * check the flag themselves too).
 *
 * Size (ml) is a product variant, not a category — never add an `?ml=` entry.
 */
export type StoreMenuKey = "catalog";

export interface StoreNavItem {
  href: string;
  label: string;
  hint: string;
  menu?: StoreMenuKey;
  flag?: FeatureFlag;
  /**
   * Шошгоны баруун дээд талд «Шинэ» тэмдэг (header, drawer). Хэрэглэгч
   * `key`-тэй хуудсыг нээмэгц (`MarkSeen`) алга болно. Хугацаа: `flag`-тай
   * мөрөнд тугийг АСААСНААС `days` хоног (өгөгдмөл 30) — нээх өдрийг
   * урьдчилж мэдэх шаардлагагүй; туггүй мөрөнд `until` (ISO) заавал.
   * Мөнхөд гялалзах тэмдэг анхаарал татахаа больдог.
   *
   * Шинэ цэс нэмэхэд: `newBadge: { key: "<хуудас>" }` + тэр хуудсанд
   * `<MarkSeen seenKey="<хуудас>" />`.
   */
  newBadge?: { key: string; days?: number; until?: string };
}

export const STORE_NAV_PRIMARY: readonly StoreNavItem[] = [
  {
    href: "/catalog",
    label: "Каталог",
    hint: "Бүх үнэртэн · 2/5/10/20 мл",
    menu: "catalog",
  },
  { href: "/collections", label: "Бэлэн багц", hint: "Бэлэн багцууд" },
  {
    href: "/collections/build",
    label: "Багц үүсгэх",
    hint: "Дуртай үнэртнүүдээ өөрөө сонго",
  },
  // Нэмэлт бараа хоёр хуудас (extras-shop-plan §19): шил нь үнэртнээр,
  // хэрэгсэл нь зорилгоор хайгддаг. Дэлгэрэнгүй `/extras/[slug]` аль алийг
  // нь тодруулахгүй — `/products/[slug]` «Каталог»-ийг тодруулдаггүйтэй ижил.
  {
    href: "/bottles",
    label: "Үнэртний шил",
    hint: "Бүтэн, үлдэгдэлтэй, хоосон шил",
    flag: "extras_shop",
    newBadge: { key: "bottles" },
  },
  {
    href: "/accessories",
    label: "Дагалдах хэрэгсэл",
    hint: "Бэлгийн сав, грамын сав, шприц",
    flag: "extras_shop",
    newBadge: { key: "accessories" },
  },
];

export const STORE_NAV_SECONDARY: readonly StoreNavItem[] = [
  { href: "/quiz", label: "Үнэрээ олох", hint: "Хэдэн асуултаар тохирохыг ол" },
  // gift-cards-plan §5.2 — `extras_shop`-оос бие даасан туг.
  {
    href: "/gift-cards",
    label: "Бэлгийн карт",
    hint: "Хайртай хүндээ үнэрийн сонголт бэлэглэ",
    flag: "gift_cards",
    newBadge: { key: "gift-cards" },
  },
];

/** Асаалттай тугтай (эсвэл туггүй) мөрүүд л. */
export function visibleNavItems<T extends StoreNavItem>(
  items: readonly T[],
  flags: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !item.flag || flags.has(item.flag));
}

/** `/collections` is active on bundle pages but not inside the builder. */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/collections") {
    return (
      pathname.startsWith("/collections") &&
      !pathname.startsWith("/collections/build")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
