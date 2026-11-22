import { HERO_LIMITS as L } from "@/lib/constants";
import { HERO_PHOTO, type HomeCampaign } from "@/features/marketing/home-content";
import type { HeroCopy } from "./default-copy";
import { desktopSrc, heroTargetHref } from "./lib";
import type {
  HeroAdminRow,
  HeroDesktopImage,
  HeroMobileImage,
  HeroTarget,
} from "./types";

/**
 * Баннерын canvas засварын (studio-ux.md D3, §5.4, §6) цэвэр хэсэг: аль
 * талбар хаана, хязгаар, хоосон үеийн орлуулагч, урьдчилсан харагдацын
 * `HomeCampaign`. React, сүлжээ байхгүй.
 */
export interface HeroCanvasDraft extends HeroCopy {
  desktopImage: HeroDesktopImage | null;
  mobileImage: HeroMobileImage | null;
  imageAlt: string;
  dark: boolean;
}

/** DB мөр → canvas. */
export function canvasFromHero(r: HeroAdminRow): HeroCanvasDraft {
  return {
    eyebrow: r.eyebrow,
    title: r.title,
    description: r.description,
    mobileDescription: r.mobileDescription ?? "",
    primaryLabel: r.primaryLabel,
    primaryTarget: r.primaryTarget,
    secondaryLabel: r.secondaryLabel ?? "",
    secondaryTarget: r.secondaryTarget,
    desktopImage: r.desktopImage,
    mobileImage: r.mobileImage,
    imageAlt: r.imageAlt,
    dark: r.dark,
  };
}

/** `CampaignHero` доторх `data-hero-field` утгууд. */
export const HERO_FIELDS = [
  "eyebrow",
  "title",
  "description",
  "mobileDescription",
  "primary",
  "secondary",
] as const;
export type HeroField = (typeof HERO_FIELDS)[number];

export type CanvasView = "desktop" | "mobile";

export const HERO_FIELD_LABEL: Record<HeroField, string> = {
  eyebrow: "Дээд мөр",
  title: "Гарчиг",
  description: "Тайлбар",
  mobileDescription: "Утасны тайлбар",
  primary: "Гол товч",
  secondary: "Нэмэлт товч",
};

export const HERO_FIELD_MAX: Record<HeroField, number> = {
  eyebrow: L.eyebrow,
  title: L.title,
  description: L.description,
  mobileDescription: L.mobileDescription,
  primary: L.buttonLabel,
  secondary: L.buttonLabel,
};

/** Хоосон үед бүдгээр харагдах орлуулагч (§6.1-5). */
const PLACEHOLDER: Record<HeroField, string> = {
  eyebrow: "+ Дээд мөр нэмэх",
  title: "Гарчиг бичнэ үү",
  description: "+ Тайлбар нэмэх",
  mobileDescription: "",
  primary: "Товчны бичиг",
  secondary: "+ Нэмэлт товч",
};

/** Заавал талбар — хоосон бол улаан хүрээ. */
const REQUIRED: readonly HeroField[] = ["title", "primary"];

export function heroFieldValue(d: HeroCanvasDraft, f: HeroField): string {
  switch (f) {
    case "primary":
      return d.primaryLabel;
    case "secondary":
      return d.secondaryLabel;
    default:
      return d[f];
  }
}

/** Нэмэлт товч анх бичигдэхэд очих газар. */
export const SECONDARY_DEFAULT_TARGET: HeroTarget = { type: "path", href: "/catalog" };

export function withHeroField(
  d: HeroCanvasDraft,
  f: HeroField,
  value: string,
): HeroCanvasDraft {
  switch (f) {
    case "primary":
      return { ...d, primaryLabel: value };
    case "secondary":
      return {
        ...d,
        secondaryLabel: value,
        secondaryTarget: value.trim()
          ? (d.secondaryTarget ?? SECONDARY_DEFAULT_TARGET)
          : null,
      };
    default:
      return { ...d, [f]: value };
  }
}

/** Харагдац бүрт тэнд гардаг л талбар засагдана (§5.4). */
export function viewFields(view: CanvasView): HeroField[] {
  return view === "desktop"
    ? ["eyebrow", "title", "description", "primary", "secondary"]
    : ["eyebrow", "title", "mobileDescription", "primary"];
}

export interface CanvasPreview {
  campaign: HomeCampaign;
  /** Орлуулагч текстээр зурсан талбарууд (бүдэг). */
  placeholders: HeroField[];
  /** Заавал боловч хоосон (улаан). */
  invalid: HeroField[];
  /** Жинхэнэ зураг сонгоогүй — жишээ зураг. */
  sample: { desktop: boolean; mobile: boolean };
}

/**
 * Canvas-д зурах `HomeCampaign`. Засварын үед хоосон талбарт орлуулагч;
 * `view` (зөвхөн харах) үед дэлгүүрт гарах ёсоор — хоосон нь хоосон, нэмэлт
 * товчгүй. Зураг сонгоогүй бол нүүрний үндсэн баннерын жишээ зураг (§5.4).
 */
export function canvasPreview(
  d: HeroCanvasDraft,
  mode: "edit" | "view" = "edit",
): CanvasPreview {
  const placeholders: HeroField[] = [];
  const invalid: HeroField[] = [];
  const text = (f: HeroField): string => {
    const v = heroFieldValue(d, f);
    if (v.trim()) return v;
    if (mode === "view") return f === "mobileDescription" ? "" : v;
    if (REQUIRED.includes(f)) invalid.push(f);
    if (f === "mobileDescription") {
      // Хоосон бол дэлгүүрт компьютерынх гарна — бүдгээр тэрийг харуулна.
      if (!d.description.trim()) return "";
      placeholders.push(f);
      return d.description;
    }
    placeholders.push(f);
    return PLACEHOLDER[f];
  };

  const sample = { desktop: !d.desktopImage, mobile: !d.mobileImage };
  const desktop = d.desktopImage
    ? {
        src: desktopSrc(d.desktopImage, 1600),
        width: 1600,
        height: d.desktopImage.height1600,
        srcSet: [...d.desktopImage.widths]
          .sort((a, b) => a - b)
          .map((w) => `${desktopSrc(d.desktopImage!, w)} ${w}w`)
          .join(", "),
      }
    : {
        src: HERO_PHOTO.src,
        width: HERO_PHOTO.width,
        height: HERO_PHOTO.height,
        srcSet: HERO_PHOTO.srcSet,
      };

  const campaign: HomeCampaign = {
    id: "canvas",
    startsOn: null,
    endsOn: null,
    eyebrow: text("eyebrow"),
    title: text("title"),
    description: text("description"),
    mobileDescription: text("mobileDescription") || undefined,
    primary: { label: text("primary"), href: heroTargetHref(d.primaryTarget) },
    secondary:
      mode === "view" && !d.secondaryLabel.trim()
        ? undefined
        : {
            label: text("secondary"),
            href: d.secondaryTarget ? heroTargetHref(d.secondaryTarget) : "/catalog",
          },
    image: {
      kind: "static",
      ...desktop,
      alt: d.imageAlt || d.title,
      mobile: d.mobileImage ?? HERO_PHOTO.mobile,
      // Жишээ зураг цайвар ханатай.
      dark: d.desktopImage ? d.dark : false,
    },
  };
  return { campaign, placeholders, invalid, sample };
}

/**
 * Баннер бүрэн болоход дутуу зүйлс — админд яг юу дутууг хэлнэ
 * (шар анхааруулга, идэвхгүй товчны шалтгаан). Хоосон = бүрэн.
 */
export function heroCanvasMissing(d: HeroCanvasDraft): string[] {
  const out: string[] = [];
  if (!d.desktopImage) out.push("компьютерын зураг");
  if (!d.mobileImage) out.push("утасны зураг");
  if (!d.title.trim()) out.push("гарчиг");
  if (!d.primaryLabel.trim()) out.push("гол товчны бичиг");
  return out;
}

/** Баннер бүрэн (D6): хоёр зураг + гарчиг + гол товчны бичиг. */
export function heroCanvasComplete(d: HeroCanvasDraft): boolean {
  return Boolean(
    d.desktopImage && d.mobileImage && d.title.trim() && d.primaryLabel.trim(),
  );
}
