import "server-only";

/**
 * Картын PNG (satori)-д VON/SCENT лого. Сайт дээр `.brand-mark` нь CSS mask +
 * `currentColor` — satori mask/filter-ийг найдвартай зурдаггүй тул
 * `public/brand/von-mark.png`-ийн alpha-г загварын текстийн өнгөөр будаж
 * data URL болгоно. Өнгө бүрт instance-д нэг удаа. Унавал null — route текст
 * wordmark-аар орлуулна (зураг гарахгүй байснаас дээр).
 *
 * Файлыг `fs`-ээр биш тухайн хүсэлтийн origin-оос татна: serverless
 * function-ий bundle-д `public/` ордоггүй.
 */
const cache = new Map<string, Promise<string | null>>();

/** Хэвлэх өндрийн 2x — 1200 өргөн картад ~92px өндөртэй зурагдана. */
const MARK_HEIGHT = 192;

async function build(origin: string, color: string): Promise<string | null> {
  try {
    const res = await fetch(new URL("/brand/von-mark.png", origin), {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const mark = sharp(Buffer.from(await res.arrayBuffer())).resize({
      height: MARK_HEIGHT,
    });
    const { data: alpha, info } = await mark
      .ensureAlpha()
      .extractChannel(3)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const png = await sharp({
      create: {
        width: info.width,
        height: info.height,
        channels: 3,
        background: color,
      },
    })
      .joinChannel(alpha, {
        raw: { width: info.width, height: info.height, channels: 1 },
      })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export function brandMarkDataUrl(
  origin: string,
  color: string,
): Promise<string | null> {
  let p = cache.get(color);
  if (!p) {
    p = build(origin, color);
    cache.set(color, p);
    void p.then((d) => d ?? cache.delete(color));
  }
  return p;
}

/** von-mark.png-ийн харьцаа (233×240). */
export const BRAND_MARK_RATIO = 233 / 240;
