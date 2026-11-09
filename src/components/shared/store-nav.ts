/**
 * Storefront navigation — one list for the desktop header row and the mobile
 * drawer, so the two never disagree.
 *
 * An entry with `menu` opens a dropdown panel on desktop instead of being a
 * plain link; the panel's content is rendered on the server and handed to the
 * header by key (see `SiteHeader`'s `menus` prop). The drawer still links
 * straight to `href`.
 *
 * «Нэмэлт бараа» (extras) is deliberately absent: the extras shop is not on
 * this branch's base yet, and a menu entry must not lead to an empty page.
 * When it lands, add `{ href: "/extras", label: "Нэмэлт бараа", menu: "extras" }`
 * here and pass its panel under the same key.
 *
 * Size (ml) is a product variant, not a category — never add an `?ml=` entry.
 */
export type StoreMenuKey = "catalog";

export interface StoreNavItem {
  href: string;
  label: string;
  hint: string;
  menu?: StoreMenuKey;
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
];

export const STORE_NAV_SECONDARY: readonly StoreNavItem[] = [
  { href: "/quiz", label: "Үнэрээ олох", hint: "Хэдэн асуултаар тохирохыг ол" },
];

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
