import type { Gender } from "@/db/types";
import type { BottleStyle } from "@/lib/constants";

/** Савны өнгөний богино нэр — «Ягаан 10ml». */
export const VIAL_STYLE_SHORT: Record<BottleStyle, string> = {
  black: "Хар",
  pink: "Ягаан",
  silver: "Мөнгөлөг",
};

/** «Ягаан 10ml», «2ml сав», «1ml сав». */
export function vialName(v: { style: BottleStyle | null; ml: number }): string {
  return v.style ? `${VIAL_STYLE_SHORT[v.style]} ${v.ml}ml` : `${v.ml}ml сав`;
}

/**
 * Хүйсээр өгөгдмөл савны өнгө (extras-shop-plan §2.1 №1).
 *
 * ⚠ SQL-ийн `default_vial_style()` (0145)-тэй таарах ёстой — сан нь reserve,
 * зарагдах эсэхийг шийднэ, энд зөвхөн харуулах.
 */
export function defaultVialStyle(gender: Gender): BottleStyle {
  if (gender === "male") return "black";
  if (gender === "female") return "pink";
  return "silver";
}

/** 1ml, 2ml сав өнгөгүй — `vial_for()`-той ижил дүрэм. */
export function vialHasStyle(ml: number): boolean {
  return ml > 2;
}

/**
 * Бараа + хэмжээнд цутгах савны өнгө: override асаалттай бол түүний өнгө,
 * эс бөгөөс барааны сонгосон өнгө, тэр нь ч байхгүй бол хүйсээр.
 * 2ml-ээс бага бол null (өнгөгүй сав).
 */
export function vialStyleFor(input: {
  ml: number;
  gender: Gender;
  vialStyle: BottleStyle | null;
  overrideStyle?: BottleStyle | null;
}): BottleStyle | null {
  if (!vialHasStyle(input.ml)) return null;
  return (
    input.overrideStyle ?? input.vialStyle ?? defaultVialStyle(input.gender)
  );
}
