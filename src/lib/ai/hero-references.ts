import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicUrl, uploadImage } from "@/lib/storage/storage";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * AI hero-гийн суурь reference (prompts/hero.md §2): одоогийн hero-гийн мастер
 * — desktop `public/desktop.webp` (3584×1280), утас `public/mobile.png`.
 *
 * OpenAI руу илгээхийн өмнө манай сервер URL-аас татдаг тул storage-д нэг
 * удаа хуулна (`hero/reference/…`, давтагдашгүй нэр — эх файл солигдвол
 * `REFERENCE_VERSION`-ийг ахиул). Файлыг lambda-д `outputFileTracingIncludes`
 * (next.config.ts) оруулдаг; preview-ийн Vercel хамгаалалт өөрийн public
 * файлыг HTTP-ээр татахыг хаадаг тул fs-ээс уншина.
 */
const REFERENCE_VERSION = "v4";

const FILES = {
  desktop: { file: "desktop.webp", type: "image/webp" },
  mobile: { file: "mobile.png", type: "image/png" },
} as const;

export async function heroReferenceUrl(
  kind: "desktop" | "mobile",
): Promise<string> {
  const f = FILES[kind];
  const path = `hero/reference/${REFERENCE_VERSION}-${f.file}`;
  const url = publicUrl(path);
  const head = await fetch(url, { method: "HEAD" }).catch(() => null);
  if (head?.ok) return url;
  const bytes = await readFile(join(process.cwd(), "public", f.file));
  const up = await uploadImage(path, bytes, f.type);
  if (!up) throw new Error("Лавлах зургийг storage-д хуулж чадсангүй.");
  return up.url;
}

export interface HeroProductRef {
  id: string;
  brand: string;
  name: string;
  url: string;
}

/**
 * Hero-д оруулах барааны лавлах зураг (ихдээ 3), сонгосон дарааллаар.
 * Эхлээд AI-д зориулсан цэвэр савны зураг (`reference_image_url`, 0031a —
 * 0131-ээс anon-д нууц тул service-role), байхгүй бол дэлгүүрт харагдах эхний
 * зураг, тэр ч байхгүй бол галерейн эхний зураг. Аль нэг нь зураггүй бол
 * алдаа — дутуу лавлахтай бол загвар савыг зохиож зурдаг (багцын poster-ийн
 * сургамж).
 */
export async function heroProductRefs(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  ids: readonly string[],
): Promise<
  { ok: true; products: HeroProductRef[] } | { ok: false; missing: string[] }
> {
  if (!ids.length) return { ok: true, products: [] };
  const [{ data: rows }, { data: images }] = await Promise.all([
    supabase
      .from("products")
      .select("id, brand, name, reference_image_url")
      .in("id", ids as string[]),
    supabase
      .from("product_images")
      .select("product_id, url, is_visible, sort_order")
      .in("product_id", ids as string[])
      .order("sort_order", { ascending: true }),
  ]);
  const byId = new Map(
    ((rows ?? []) as {
      id: string;
      brand: string;
      name: string;
      reference_image_url: string | null;
    }[]).map((r) => [r.id, r]),
  );
  const imgs = (images ?? []) as {
    product_id: string;
    url: string;
    is_visible: boolean;
  }[];
  const products: HeroProductRef[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    const own = imgs.filter((i) => i.product_id === id);
    const url =
      p?.reference_image_url ||
      (own.find((i) => i.is_visible) ?? own[0])?.url ||
      null;
    if (p && url) products.push({ id, brand: p.brand, name: p.name, url });
    else missing.push(p ? `${p.brand} ${p.name}` : id);
  }
  return missing.length ? { ok: false, missing } : { ok: true, products };
}
