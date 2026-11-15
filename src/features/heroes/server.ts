import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { HERO_IMAGE } from "@/lib/constants";
import { publicUrl, storagePath, uploadImage } from "@/lib/storage/storage";
import { ImageToolUnavailableError } from "@/lib/storage/process-image";
import type { HeroInput } from "@/lib/validators/hero";
import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import type { HeroDesktopImage, HeroMobileImage } from "./types";

/** Админы hero route бүрийн хаалга: туг (404) → staff (403) → service-role. */
export async function heroAdminGate() {
  if (!(await isFeatureEnabled("hero_admin"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const staff = await getStaffUser();
  if (!staff) {
    return {
      response: NextResponse.json(
        { error: "Эрх баталгаажсангүй. Хуудсаа сэргээгээд дахин нэвтэрнэ үү." },
        { status: 403 },
      ),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { supabase, staff } as const;
}

/** Зураг манай storage-ийн `hero/` доор байх ёстой — гадаад URL хориотой. */
function ownHeroUrl(url: string): boolean {
  return storagePath(url)?.startsWith("hero/") ?? false;
}

/**
 * Маягт → `heroes` мөр. Зургийн URL-ыг шалгана; арга хэмжээ / товчны
 * арга хэмжээ байгаа эсэхийг route `checkHeroRefs`-ээр тусад нь.
 */
export function toHeroColumns(input: HeroInput) {
  // Улирлын мөрийн хугацааг `season_start_md` шийднэ (0185).
  const linked = Boolean(input.saleEventId) || Boolean(input.season);
  return {
    name: input.name,
    sale_event_id: input.saleEventId,
    // Холбоотой hero-гийн хугацаа арга хэмжээнээс — өөрийнх нь хоосон.
    starts_at: linked ? null : dayStartIso(input.startsOn ?? ""),
    ends_at: linked ? null : dayEndIso(input.endsOn ?? ""),
    priority: input.priority,
    is_active: input.isActive,
    eyebrow: input.eyebrow,
    title: input.title,
    description: input.description,
    mobile_description: input.mobileDescription || null,
    primary_label: input.primaryLabel,
    primary_target: input.primaryTarget,
    secondary_label: input.secondaryLabel || null,
    secondary_target: input.secondaryLabel ? input.secondaryTarget : null,
    desktop_image: input.desktopImage,
    mobile_image: input.mobileImage,
    image_alt: input.imageAlt,
    dark: input.dark,
    season: input.season,
    season_start_md: input.seasonStartMd,
    product_ids: input.productIds,
  };
}

/**
 * Серверийн шалгалт (plan §7.3): холбосон арга хэмжээ, товчны арга хэмжээ
 * байгаа эсэх; зураг манай storage-оос. Алдаатай бол хэрэглэгчид харагдах
 * мессеж, эс бөгөөс null.
 */
export async function checkHeroRefs(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  input: HeroInput,
  /** Засаж буй мөр (PUT) — улирлын давхардлыг шалгахад өөрийгөө алгасна. */
  selfId?: string,
): Promise<string | null> {
  if (input.desktopImage && !ownHeroUrl(input.desktopImage.base + "-1600.webp"))
    return "Desktop зураг танигдсангүй — дахин оруулна уу.";
  if (input.mobileImage && !ownHeroUrl(input.mobileImage.src))
    return "Утасны зураг танигдсангүй — дахин оруулна уу.";

  const slugs = [input.primaryTarget, input.secondaryTarget]
    .filter((t) => t?.type === "event")
    .map((t) => (t as { slug: string }).slug);
  if (input.saleEventId) {
    const { data } = await supabase
      .from("sale_events")
      .select("id")
      .eq("id", input.saleEventId)
      .maybeSingle();
    if (!data) return "Холбосон арга хэмжээ олдсонгүй.";
  }
  if (input.season) {
    // Хоёр улирал нэг өдөр эхэлбэл нэг нь хэзээ ч гарахгүй (D9).
    let q = supabase
      .from("heroes")
      .select("id, season")
      .eq("season_start_md", input.seasonStartMd!)
      .neq("season", input.season);
    if (selfId) q = q.neq("id", selfId);
    const { data } = await q.limit(1);
    if (data?.length) return "Өөр улирал энэ өдөр эхэлдэг — өөр өдөр сонгоно уу.";
  }
  if (slugs.length) {
    const { data } = await supabase
      .from("sale_events")
      .select("slug")
      .in("slug", slugs);
    const found = new Set((data ?? []).map((r: { slug: string }) => r.slug));
    const missing = slugs.find((s) => !found.has(s));
    if (missing) return `Товчны арга хэмжээ «${missing}» олдсонгүй.`;
  }
  return null;
}

export function heroWriteError(message: string) {
  if (/FEATURE_DISABLED/.test(message)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (/heroes_season_uniq/.test(message)) {
    return NextResponse.json(
      { error: "Энэ улирлын баннер аль хэдийн байна." },
      { status: 409 },
    );
  }
  if (/heroes_active_images/.test(message)) {
    return NextResponse.json(
      { error: "Нийтлэхийн өмнө desktop ба утасны зураг оруулна уу." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "Хадгалж чадсангүй. Дахин оролдоно уу." },
    { status: 500 },
  );
}

// ── Зураг ─────────────────────────────────────────────────────────────────

async function sharpLib() {
  try {
    return (await import("sharp")).default;
  } catch (err) {
    throw new ImageToolUnavailableError(err);
  }
}

export type HeroImageResult =
  | {
      ok: true;
      desktop?: HeroDesktopImage;
      mobile?: HeroMobileImage;
      /** Зүүн 0–55% (текстийн бүс)-ийн дундаж гэрэлтэлтээр `dark` санал. */
      suggestDark: boolean;
    }
  | { ok: false; error: string };

/**
 * Hero-гийн зургийг шалгаж, хэмжээнүүдийг гаргаж storage-д тавина
 * (plan §7.6, §8.2): desktop 2.8:1 ≥2400px → 1600/2400/3200 webp q80,
 * утас 4:3 → 1600 webp q85. `processImage`-ийн preset-үүд 1600-аар
 * хязгаарладаг тул өөрийн sharp алхам. Зам давтагдашгүй
 * (`hero/<groupId>/<uuid>-<w>.webp`) — CDN/Safari кэш (prompts/hero.md §4).
 */
export async function processHeroImage(
  bytes: ArrayBuffer | Buffer,
  kind: "desktop" | "mobile",
  groupId: string,
): Promise<HeroImageResult> {
  const sharp = await sharpLib();
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let meta: { width?: number; height?: number };
  try {
    meta = await sharp(input, { failOn: "error" }).rotate().metadata();
  } catch {
    return { ok: false, error: "Зураг уншигдсангүй." };
  }
  const { width = 0, height = 0 } = meta;
  const spec = HERO_IMAGE[kind];
  const ratio = width / Math.max(height, 1);
  if (Math.abs(ratio / spec.ratio - 1) > HERO_IMAGE.ratioTolerance) {
    return {
      ok: false,
      error:
        kind === "desktop"
          ? `Desktop зургийн харьцаа 2.8:1 байх ёстой (жишээ 3584×1280). Ирсэн: ${width}×${height}.`
          : `Утасны зургийн харьцаа 4:3 байх ёстой (жишээ 2048×1536). Ирсэн: ${width}×${height}.`,
    };
  }
  if (width < spec.minWidth) {
    return {
      ok: false,
      error: `Зураг хэт жижиг: өргөн дор хаяж ${spec.minWidth}px (ирсэн ${width}px).`,
    };
  }

  // Текстийн бүс (зүүн 55%) бараан эсэх — note-image-ийн borderLuma загвар.
  const stats = await sharp(input)
    .rotate()
    .extract({
      left: 0,
      top: 0,
      width: Math.max(1, Math.round(width * 0.55)),
      height,
    })
    .greyscale()
    .stats();
  const suggestDark = (stats.channels[0]?.mean ?? 255) < 110;

  const id = crypto.randomUUID();
  if (kind === "desktop") {
    const d = HERO_IMAGE.desktop;
    const base = `hero/${groupId}/${id}`;
    let height1600 = Math.round(1600 / d.ratio);
    for (const w of d.widths) {
      const { data, info } = await sharp(input)
        .rotate()
        .resize({ width: w, withoutEnlargement: false })
        .webp({ quality: d.quality })
        .toBuffer({ resolveWithObject: true });
      if (w === 1600) height1600 = info.height;
      const up = await uploadImage(`${base}-${w}.webp`, data, "image/webp");
      if (!up) return { ok: false, error: "Хадгалж чадсангүй (storage)." };
    }
    return {
      ok: true,
      suggestDark,
      desktop: {
        base: publicUrl(base),
        widths: [...d.widths],
        height1600,
      },
    };
  }

  const m = HERO_IMAGE.mobile;
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: m.width, withoutEnlargement: true })
    .webp({ quality: m.quality })
    .toBuffer({ resolveWithObject: true });
  const up = await uploadImage(`hero/${groupId}/${id}-m${m.width}.webp`, data, "image/webp");
  if (!up) return { ok: false, error: "Хадгалж чадсангүй (storage)." };
  return {
    ok: true,
    suggestDark,
    mobile: { src: up.url, width: info.width, height: info.height },
  };
}
