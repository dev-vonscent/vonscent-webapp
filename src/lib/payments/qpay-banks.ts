/**
 * The banks and wallets that can pay a QPay invoice.
 *
 * QPay returns the authoritative list with every created invoice — name, logo
 * URL and a deeplink — and that list is what the payment page renders. This
 * table adds only what QPay does not send:
 *
 *   - **a Mongolian name.** QPay's are English and inconsistent
 *     ("Trade and Development bank", "State bank 3.0"). The names here are the
 *     ones the customer sees on their own phone, taken from QPay's own
 *     "Төлбөрийн хэрэгсэл" screen: "TDB online", not "Худалдаа хөгжлийн банк".
 *   - **a category.** Twenty-three icons in one grid is a wall; split into
 *     wallets and banks it scans in a second, which is how QPay groups them.
 *   - **an order.** QPay's order is arbitrary; a customer should meet Хаан and
 *     TDB first, not Tino.
 *   - **a fallback label.** When the logo URL 404s or the CDN is slow, a tile
 *     still has to say which bank it is.
 *
 * Matching is by URL scheme, the one stable part of a deeplink
 * (`qpay/FINDINGS.md` §2 — all 23 links carry the same `qr_text` and differ
 * only in scheme). An unlisted app is not dropped: it keeps QPay's own name
 * and lands in "Бусад", so an app QPay adds tomorrow still works today.
 */

export type BankCategory = "wallet" | "bank" | "other";

export interface BankMeta {
  /** URL scheme without `://`. */
  scheme: string;
  /** Display name, as the app is labelled in Mongolia. */
  name: string;
  /** Short stand-in when there is no logo. */
  short: string;
  category: BankCategory;
}

/** Order within a category is display order: what most customers hold, first. */
const BANKS: readonly BankMeta[] = [
  // ── Банк ────────────────────────────────────────────────────────────
  { scheme: "khanbank", name: "Хаан банк", short: "ХААН", category: "bank" },
  { scheme: "tdbbank", name: "TDB online", short: "TDB", category: "bank" },
  {
    scheme: "socialpay-payment",
    name: "SocialPay",
    short: "SP",
    category: "bank",
  },
  {
    scheme: "statebankmongolia",
    name: "Төрийн банк 3.0",
    short: "ТБ",
    category: "bank",
  },
  { scheme: "xacbank", name: "Хас банк", short: "ХАС", category: "bank" },
  { scheme: "mbank", name: "M Bank", short: "M", category: "bank" },
  {
    scheme: "capitronbank",
    name: "Капитрон банк",
    short: "КАП",
    category: "bank",
  },
  { scheme: "arig", name: "Ариг банк", short: "АРИГ", category: "bank" },
  { scheme: "bogdbank", name: "Богд банк", short: "БОГД", category: "bank" },
  {
    scheme: "ckbank",
    name: "Чингис хаан банк",
    short: "ЧХБ",
    category: "bank",
  },
  {
    scheme: "nibank",
    name: "Хөрөнгө оруулалтын банк",
    short: "ХОБ",
    category: "bank",
  },
  {
    scheme: "transbank",
    name: "Тээвэр хөгжлийн банк",
    short: "ТХБ",
    category: "bank",
  },

  // ── Цахим хэтэвч ────────────────────────────────────────────────────
  { scheme: "toki", name: "Toki", short: "TOKI", category: "wallet" },
  { scheme: "tdbwallet", name: "Happy Pay", short: "HP", category: "wallet" },
  { scheme: "hipay", name: "Hi Pay", short: "HI", category: "wallet" },
  { scheme: "most", name: "МОСТ мони", short: "MOST", category: "wallet" },
  { scheme: "monpay", name: "Monpay", short: "MP", category: "wallet" },
  { scheme: "ard", name: "Ард Апп", short: "ARD", category: "wallet" },
  { scheme: "pass", name: "Pass", short: "PASS", category: "wallet" },
  {
    scheme: "qpaywallet",
    name: "qPay хэтэвч",
    short: "qPay",
    category: "wallet",
  },
  { scheme: "sono", name: "Sono", short: "SONO", category: "wallet" },
  { scheme: "payon", name: "PayOn", short: "PAY", category: "wallet" },
  { scheme: "tino", name: "Tino", short: "TINO", category: "wallet" },
];

const BY_SCHEME = new Map(BANKS.map((b) => [b.scheme, b]));
const ORDER = new Map(BANKS.map((b, i) => [b.scheme, i]));

export const CATEGORY_LABEL: Record<BankCategory, string> = {
  bank: "Банк",
  wallet: "Цахим хэтэвч",
  other: "Бусад",
};

/** Banks lead — most customers pay from a bank app, not a wallet. */
const CATEGORY_ORDER: readonly BankCategory[] = ["bank", "wallet", "other"];

export function schemeOf(link: string): string {
  const i = link.indexOf("://");
  return i < 0 ? "" : link.slice(0, i).toLowerCase();
}

/** A deeplink with display metadata resolved. */
export interface BankLink {
  name: string;
  short: string;
  link: string;
  logo: string | null;
  scheme: string;
  category: BankCategory;
}

export interface BankGroup {
  category: BankCategory;
  label: string;
  banks: BankLink[];
}

function resolve(d: { name: string; link: string; logo?: string }): BankLink {
  const scheme = schemeOf(d.link);
  const meta = BY_SCHEME.get(scheme);
  return {
    name: meta?.name ?? d.name,
    short: meta?.short ?? d.name.slice(0, 4).toUpperCase(),
    link: d.link,
    logo: d.logo?.trim() || null,
    scheme,
    category: meta?.category ?? "other",
  };
}

/**
 * Group and order QPay's deeplinks for display.
 *
 * `link` and `logo` always come from QPay — only the label, the group and the
 * position are ours. Empty groups are dropped rather than rendering a heading
 * with nothing under it.
 */
export function groupBankLinks(
  deeplinks: { name: string; link: string; logo?: string }[],
): BankGroup[] {
  const banks = deeplinks.filter((d) => d.link).map(resolve);
  return buildGroups(banks);
}

function buildGroups(banks: BankLink[]): BankGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    banks: banks
      .filter((b) => b.category === category)
      .sort(
        (a, b) =>
          (ORDER.get(a.scheme) ?? BANKS.length) -
          (ORDER.get(b.scheme) ?? BANKS.length),
      ),
  })).filter((g) => g.banks.length > 0);
}

/** Find one resolved app by scheme — for the "recently used" row. */
export function findBank(groups: BankGroup[], scheme: string): BankLink | null {
  for (const g of groups) {
    const hit = g.banks.find((b) => b.scheme === scheme);
    if (hit) return hit;
  }
  return null;
}

/**
 * The grid as it looks with a real invoice — for **mock mode only**, so the
 * payment page can be designed and reviewed without merchant credentials.
 *
 * Every entry is deliberately linkless: opening a real banking app with a
 * fabricated QR would just show the customer a bank-side error, and
 * reconstructing QPay's deeplinks from a scheme is exactly the guess
 * `qpay/FINDINGS.md` warns against. The tiles render, and do nothing.
 */
export function mockBankGroups(): BankGroup[] {
  return buildGroups(
    BANKS.map((b) => ({
      name: b.name,
      short: b.short,
      link: "",
      logo: null,
      scheme: b.scheme,
      category: b.category,
    })),
  );
}
