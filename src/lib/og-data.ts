import { OG_CHIP_DOT, type OgCardData } from "@/lib/og";
import { getProductPageBySlug } from "@/features/products/api";
import { getCollectionBySlug } from "@/features/collections/api";
import { formatDiscountRange } from "@/features/collections/pricing";
import { formatPrice } from "@/lib/format";

/** Concentration code → the caps label printed on the card. */
const CONCENTRATION_LABEL: Record<string, string> = {
  edp: "Eau de Parfum",
  edt: "Eau de Toilette",
  edc: "Eau de Cologne",
  parfum: "Parfum",
  extrait: "Extrait de Parfum",
};

function concentrationLabel(code: string): string | undefined {
  const c = code.trim();
  if (!c) return undefined;
  const [head, ...rest] = c.split(/\s+/);
  const full = CONCENTRATION_LABEL[head.toLowerCase()];
  return full ? [full, ...rest].join(" ") : c;
}

/** One line of the card fits ~50 Inter characters at 19px. */
const SUBLINE_CHARS = 50;

/**
 * «A · B · C» — as many member names as fit one line, the rest counted
 * («A · B · +2»). satori can't ellipsize, it just clips mid-word.
 */
export function memberLine(names: string[]): string | undefined {
  const shown: string[] = [];
  for (const [i, name] of names.entries()) {
    const rest = names.length - i - 1;
    const tail = rest ? ` · +${rest}` : "";
    const next = [...shown, name].join(" · ");
    if ((next + tail).length > SUBLINE_CHARS && shown.length) {
      return `${shown.join(" · ")} · +${names.length - shown.length}`;
    }
    shown.push(name);
  }
  return shown.length ? shown.join(" · ") : undefined;
}

/** Share-card data for a product page (null → not found). */
export async function productOgData(slug: string): Promise<OgCardData | null> {
  // Барааны хуудастай ижил — «Тун удахгүй» ус (0125) ч хуваалцагдана.
  const product = await getProductPageBySlug(slug);
  if (!product) return null;
  const comingSoon = Boolean(product.comingSoon);
  // «Тун удахгүй» ус бас `soldOut` — гэхдээ дууссан биш, үнэ нь мэдэгдэнэ.
  const soldOut = product.soldOut && !comingSoon;
  const sizes = product.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.ml - b.ml)
    .map((v) => ({ ml: v.ml, off: soldOut || (!comingSoon && !v.sellable) }));
  return {
    kicker: product.brand,
    name: product.name,
    label: soldOut ? undefined : concentrationLabel(product.concentration),
    // Хувь харуулахгүй (backlog B4) — хямдралтай эсэхийг л дохино.
    promo:
      !soldOut && product.startingBasePrice > product.startingPrice
        ? "Хямдрал"
        : undefined,
    chip: soldOut
      ? { text: "Дууссан", dot: OG_CHIP_DOT.soldOut }
      : comingSoon
        ? { text: "Тун удахгүй", dot: OG_CHIP_DOT.soon }
        : undefined,
    price: formatPrice(product.startingPrice),
    soldOut,
    sizes,
    imageUrl: product.image?.url ?? null,
  };
}

/** Share-card data for a collection page (null → not found). */
export async function collectionOgData(
  slug: string,
): Promise<OgCardData | null> {
  const collection = await getCollectionBySlug(slug);
  if (!collection) return null;
  const { soldOut, members, discountRange } = collection;
  return {
    kicker: "Багц",
    name: collection.name,
    promo:
      !soldOut && discountRange.max
        ? `−${formatDiscountRange(discountRange)} хямдрал`
        : undefined,
    chip: soldOut
      ? { text: "Дууссан", dot: OG_CHIP_DOT.soldOut }
      : members.length
        ? { text: `${members.length} үнэртэн` }
        : undefined,
    subline: memberLine(members.map((m) => m.name)),
    price: formatPrice(collection.startingPrice),
    soldOut,
    sizes: collection.prices
      .map((p) => ({
        ml: p.ml,
        off: soldOut || !collection.availableMls.includes(p.ml),
      }))
      .sort((a, b) => a.ml - b.ml),
    sizesLabel: soldOut ? "Хэмжээ" : "Хэмжээ сонгох · ширхэг бүрд",
    imageUrl: collection.image,
  };
}
