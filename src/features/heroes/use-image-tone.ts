"use client";

import * as React from "react";

/** Зургийн текстийн бүсийн (зүүн тал) гэрэлтэлт, 0–255. */
export interface ImageTone {
  /** Дундаж luma. */
  mean: number;
  /** Стандарт хазайлт — их бол алаг дэвсгэр (сүүдэр, навч г.м.). */
  spread: number;
}

/** Компьютерын баннерт текст зүүн ~45%-д байрладаг (CampaignHero). */
const TEXT_ZONE = 0.45;

/**
 * Зургийн зүүн талын гэрэлтэлтийг хөтөч дээр тооцно — «Текстийн өнгө» нь
 * зурагтай тохирч байгаа эсэхийг анхааруулахад (server талын `suggestDark`
 * нь зөвхөн upload/AI-ийн мөчид ирдэг, хадгалагддаггүй).
 * CORS-оор уншиж чадахгүй бол `null` — анхааруулга зүгээр л гарахгүй.
 */
export function useImageTone(src: string | null): ImageTone | null {
  const [tone, setTone] = React.useState<{
    src: string;
    tone: ImageTone;
  } | null>(null);

  React.useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = 96;
        const h = Math.max(
          1,
          Math.round((w * img.naturalHeight) / img.naturalWidth),
        );
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const zone = Math.max(1, Math.round(w * TEXT_ZONE));
        const { data } = ctx.getImageData(0, 0, zone, h);
        let sum = 0;
        let sq = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const l =
            0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          sum += l;
          sq += l * l;
        }
        const mean = sum / n;
        const spread = Math.sqrt(Math.max(0, sq / n - mean * mean));
        setTone({ src, tone: { mean, spread } });
      } catch {
        // tainted canvas (CORS) — анхааруулгагүй үлдэнэ.
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return src && tone?.src === src ? tone.tone : null;
}

/** Текстийн өнгө зурагтай зөрж байвал админд харуулах өгүүлбэр; зүгээр бол null. */
export function toneWarning(
  tone: ImageTone | null,
  lightText: boolean,
): string | null {
  if (!tone) return null;
  if (!lightText && tone.mean < 110)
    return "Зургийн зүүн тал бараан тул бараан текст бүдэг харагдана — «Цагаан» сонгоно уу.";
  if (lightText && tone.mean > 150)
    return "Зургийн зүүн тал цайвар тул цагаан текст бүдэг харагдана — «Бараан» сонгоно уу.";
  if (tone.spread > 50)
    return "Текстийн ард зураг алаг (сүүдэр, хээ) — жижиг тайлбар уншигдахгүй байж магадгүй. Тайлбарыг богиносгох эсвэл тайван дэвсгэртэй зураг сонгоно уу.";
  return null;
}
