import {
  Droplet,
  FlaskConical,
  Gift,
  Package,
  Syringe,
  type LucideIcon,
} from "lucide-react";

/** Ангиллын дүрс — seed-ийн slug-аар (0145, 0153); шинэ ангилалд Package. */
const ICON: Record<string, LucideIcon> = {
  "gift-box": Gift,
  vial: FlaskConical,
  bottled: Droplet,
  "empty-bottle": Package,
  syringe: Syringe,
};

export function categoryIcon(slug: string): LucideIcon {
  return ICON[slug] ?? Package;
}
