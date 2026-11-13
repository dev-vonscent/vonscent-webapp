import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicUrl, uploadImage } from "@/lib/storage/storage";

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
