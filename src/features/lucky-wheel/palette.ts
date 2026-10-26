import type { WheelPrize } from "./types";

/**
 * Азын хүрдний хэсгийн өнгө.
 *
 * Хүрд нь брэндийн монохром палитрт (design.md §2) — хэсэг бүр темийн
 * foreground-ыг background дээр `color-mix`-ээр шатлана: «Баярлалаа» хамгийн
 * бүдэг, энгийн шагнал дунд, ховор шагнал арай тод. Ганц онцгой нь гранд
 * шагнал: гэрэлтсэн алт (`--wheel-gold*`), алтан хүрээтэйгээ нэг гэр бүл.
 */

export interface PrizeColor {
  /** Wedge fill. */
  fill: string;
  /** Label colour on that fill. */
  text: string;
}

const mix = (pct: number) =>
  `color-mix(in oklab, var(--foreground) ${pct}%, var(--background))`;

export const GRAND_COLOR: PrizeColor = {
  fill: "var(--wheel-gold)",
  text: "var(--wheel-ink-dark)",
};

export const RARE_COLOR: PrizeColor = {
  fill: mix(24),
  text: "var(--foreground)",
};

export const COMMON_COLOR: PrizeColor = {
  fill: mix(14),
  text: "var(--foreground)",
};

export const BLANK_COLOR: PrizeColor = {
  fill: mix(4),
  text: mix(55),
};

/** Same prize, same colour — the key a repeated wedge is matched on. */
function keyOf(p: Pick<WheelPrize, "kind" | "value">): string {
  return `${p.kind}:${p.value}`;
}

function colorFor(p: Pick<WheelPrize, "kind" | "tier">): PrizeColor {
  if (p.tier === "grand") return GRAND_COLOR;
  if (p.kind === "none") return BLANK_COLOR;
  return p.tier === "rare" ? RARE_COLOR : COMMON_COLOR;
}

/** Colour per prize, keyed so repeated wedges share one entry. */
export function prizeColors(prizes: WheelPrize[]): Map<string, PrizeColor> {
  const out = new Map<string, PrizeColor>();
  for (const p of prizes) {
    if (!out.has(keyOf(p)) || p.tier === "grand") {
      out.set(keyOf(p), colorFor(p));
    }
  }
  return out;
}

/** Colour of one prize, given the map from `prizeColors`. */
export function colorOf(
  colors: Map<string, PrizeColor>,
  prize: Pick<WheelPrize, "kind" | "value" | "tier">,
): PrizeColor {
  if (prize.tier === "grand") return GRAND_COLOR;
  return colors.get(keyOf(prize)) ?? colorFor(prize);
}
