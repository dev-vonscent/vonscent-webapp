import { HERO_IMAGE } from "@/lib/constants";
import { MAX_IMAGE_BYTES } from "@/lib/storage/limits";

/**
 * Hero-гийн зургийг хөтөч дээр бэлтгэнэ: харьцаа, хамгийн бага өргөнийг
 * шууд хэлж (сервер дахин шалгана), Vercel-ийн 4.5MB хязгаарт багтаахаар
 * desktop-ыг 3200px, утсыг 1600px өргөн өндөр чанартай JPEG болгоно —
 * серверийн webp encode нь цорын ганц бүдэг алхам хэвээр.
 */
export async function prepareHeroUpload(
  file: File,
  kind: "desktop" | "mobile",
): Promise<{ ok: true; file: File } | { ok: false; message: string }> {
  if (typeof createImageBitmap !== "function") return { ok: true, file };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, message: "Зураг уншигдсангүй (PNG, JPEG, WebP)." };
  }
  const spec = HERO_IMAGE[kind];
  const { width, height } = bitmap;
  const ratio = width / Math.max(height, 1);
  if (Math.abs(ratio / spec.ratio - 1) > HERO_IMAGE.ratioTolerance) {
    bitmap.close();
    return {
      ok: false,
      message:
        kind === "desktop"
          ? `Харьцаа 2.8:1 байх ёстой (жишээ 3584×1280). Энэ зураг ${width}×${height}.`
          : `Харьцаа 4:3 байх ёстой (жишээ 2048×1536). Энэ зураг ${width}×${height}.`,
    };
  }
  if (width < spec.minWidth) {
    bitmap.close();
    return {
      ok: false,
      message: `Өргөн дор хаяж ${spec.minWidth}px байх ёстой (энэ ${width}px).`,
    };
  }
  const target = kind === "desktop" ? 3200 : HERO_IMAGE.mobile.width;
  const w = Math.min(width, target);
  const h = Math.round((height * w) / width);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { ok: true, file };
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  for (const q of [0.92, 0.85, 0.78]) {
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", q),
    );
    if (blob && blob.size <= MAX_IMAGE_BYTES) {
      return {
        ok: true,
        file: new File([blob], `${kind}.jpg`, { type: "image/jpeg" }),
      };
    }
  }
  return { ok: false, message: "Зураг хэт том — шахаж чадсангүй." };
}
