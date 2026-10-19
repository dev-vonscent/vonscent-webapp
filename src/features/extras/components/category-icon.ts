import {
  Droplet,
  FlaskConical,
  Gift,
  Package,
  ShoppingBag,
  Syringe,
  type LucideIcon,
} from "lucide-react";

/** Ангиллын дүрс — seed-ийн slug-аар (0145); шинэ ангилалд Package. */
const ICON: Record<string, LucideIcon> = {
  "gift-box": Gift,
  vial: FlaskConical,
  leftover: Droplet,
  "empty-bottle": Package,
  syringe: Syringe,
  "brand-pouch": ShoppingBag,
};

export function categoryIcon(slug: string): LucideIcon {
  return ICON[slug] ?? Package;
}
