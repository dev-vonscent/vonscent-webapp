import "server-only";
import sharp from "sharp";
import { env } from "@/lib/env";

/**
 * Generate a product image with OpenAI gpt-image-2 (ai-image-generation §4).
 * With a reference image → the edits endpoint (image-to-image); without one →
 * generations (text-to-image). Returns an optimised WebP buffer, or throws with
 * a readable message the job stores in `error`.
 */

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type ImageQuality = "low" | "medium" | "high" | "auto";

export interface GenerateOptions {
  prompt: string;
  /** Public URL of the reference perfume image (edits mode). */
  referenceUrl?: string | null;
  /**
   * Хэд хэдэн лавлах зураг (багцын poster — гишүүн бүрийн сав). Өгсөн бол
   * `referenceUrl`-ийн оронд бүгдийг нэг edits хүсэлтэд илгээнэ.
   */
  referenceUrls?: string[];
  size?: ImageSize;
  quality?: ImageQuality;
  /**
   * Тунгалаг дэвсгэр (үнэрийн төрлийн дүрс). Зөвхөн text-to-image замд —
   * загвар PNG буцаах ёстой, JPEG/WebP-д alpha сувга байхгүй.
   */
  background?: "transparent";
}

const OPENAI = "https://api.openai.com/v1";

/**
 * One model for every image the shop generates — the app and the batch
 * scripts (`scripts/regen-product-images.ts`, `gen-note-images.ts`) move
 * together; a catalogue whose pictures come from two different models does
 * not look like one catalogue.
 */
const MODEL = "gpt-image-2";

interface OpenAiImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

async function callOpenAi(
  path: string,
  body: FormData | string,
  isJson: boolean,
): Promise<string> {
  const res = await fetch(`${OPENAI}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiKey}`,
      ...(isJson ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
  const json = (await res
    .json()
    .catch(() => null)) as OpenAiImageResponse | null;
  if (!res.ok || !json) {
    throw new Error(json?.error?.message || `OpenAI error (${res.status})`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image.");
  return b64;
}

export interface GeneratedImage {
  /** Optimised WebP, ready to store. */
  buffer: Buffer;
  /** Exactly what the model returned, for callers that must post-process. */
  raw: Buffer;
  contentType: string;
  ext: string;
}

export async function generateProductImage(
  opts: GenerateOptions,
): Promise<GeneratedImage> {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY тохируулаагүй байна.");

  const size = opts.size ?? "1024x1536";
  const quality = opts.quality ?? "medium";
  let b64: string;

  const refUrls = opts.referenceUrls?.length
    ? opts.referenceUrls
    : opts.referenceUrl
      ? [opts.referenceUrl]
      : [];

  if (refUrls.length) {
    // image-to-image: fetch the reference bytes and send as multipart.
    const refs = await Promise.all(
      refUrls.map(async (url) => {
        const refRes = await fetch(url);
        if (!refRes.ok) throw new Error("Лавлах зургийг татаж чадсангүй.");
        return new Blob([new Uint8Array(await refRes.arrayBuffer())], {
          type: refRes.headers.get("content-type") || "image/png",
        });
      }),
    );

    const form = new FormData();
    form.append("model", MODEL);
    // Нэг зураг бол `image`, олон бол `image[]` — OpenAI edits-ийн хэлбэр.
    const field = refs.length === 1 ? "image" : "image[]";
    refs.forEach((blob, i) => form.append(field, blob, `reference-${i}.png`));
    form.append("prompt", opts.prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");
    b64 = await callOpenAi("/images/edits", form, false);
  } else {
    b64 = await callOpenAi(
      "/images/generations",
      JSON.stringify({
        model: MODEL,
        prompt: opts.prompt,
        size,
        quality,
        n: 1,
        ...(opts.background === "transparent"
          ? { background: "transparent", output_format: "png" }
          : {}),
      }),
      true,
    );
  }

  // Optimise to WebP so gallery pages stay light (same as uploaded images).
  const raw = Buffer.from(b64, "base64");
  const buffer = await sharp(raw).webp({ quality: 82 }).toBuffer();
  return { buffer, raw, contentType: "image/webp", ext: "webp" };
}
