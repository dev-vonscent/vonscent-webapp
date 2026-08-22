import "server-only";
import sharp from "sharp";
import { env } from "@/lib/env";

/**
 * Generate a product image with OpenAI gpt-image-1 (ai-image-generation §4).
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
  size?: ImageSize;
  quality?: ImageQuality;
}

const OPENAI = "https://api.openai.com/v1";

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
  buffer: Buffer;
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

  if (opts.referenceUrl) {
    // image-to-image: fetch the reference bytes and send as multipart.
    const refRes = await fetch(opts.referenceUrl);
    if (!refRes.ok) throw new Error("Лавлах зургийг татаж чадсангүй.");
    const refBuf = Buffer.from(await refRes.arrayBuffer());
    const refType = refRes.headers.get("content-type") || "image/png";

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append(
      "image",
      new Blob([new Uint8Array(refBuf)], { type: refType }),
      "reference.png",
    );
    form.append("prompt", opts.prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");
    b64 = await callOpenAi("/images/edits", form, false);
  } else {
    b64 = await callOpenAi(
      "/images/generations",
      JSON.stringify({
        model: "gpt-image-1",
        prompt: opts.prompt,
        size,
        quality,
        n: 1,
      }),
      true,
    );
  }

  // Optimise to WebP so gallery pages stay light (same as uploaded images).
  const raw = Buffer.from(b64, "base64");
  const buffer = await sharp(raw).webp({ quality: 82 }).toBuffer();
  return { buffer, contentType: "image/webp", ext: "webp" };
}
