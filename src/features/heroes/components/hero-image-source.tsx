"use client";

import * as React from "react";
import { ImagePlus, Sparkles } from "lucide-react";
import type { ProductOption } from "@/features/admin/lib/product-option";
import type { HeroThemeKey } from "@/lib/ai/hero-prompt";
import { cn } from "@/lib/utils";
import type { HeroDesktopImage, HeroMobileImage } from "../types";
import { HeroAiPanel, type HeroAiResult } from "./hero-ai-panel";
import { ImageUpload } from "./hero-image-upload";

type Source = "ai" | "upload";

/**
 * Баннерын зураг (studio-ux.md §5.4 «Зураг сонгох»): AI-аар үүсгэх эсвэл
 * өөрийн зургаа оруулах. Сонгосон зураг canvas дээр шууд тавигдана.
 */
export function HeroImageSource({
  groupId,
  heroId,
  aiConfigured,
  desktopImage,
  mobileImage,
  defaultTheme,
  defaultProducts,
  onImages,
}: {
  groupId: string;
  heroId: string | null;
  aiConfigured: boolean;
  desktopImage: HeroDesktopImage | null;
  mobileImage: HeroMobileImage | null;
  defaultTheme: HeroThemeKey;
  defaultProducts: ProductOption[];
  onImages: (r: HeroAiResult) => void;
}) {
  const [source, setSource] = React.useState<Source | null>(null);
  const cards: { key: Source; icon: typeof Sparkles; title: string; hint: string; off?: string }[] = [
    {
      key: "ai",
      icon: Sparkles,
      title: "AI-аар үүсгэх",
      hint: "Сэдэв, үнэртнээ сонгоод 1–2 минутад.",
      off: aiConfigured ? undefined : "AI-ийн түлхүүр тохируулаагүй — зургаа оруулна уу.",
    },
    {
      key: "upload",
      icon: ImagePlus,
      title: "Өөрийн зураг оруулах",
      hint: "Компьютер 2.8:1, утас 4:3.",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Зураг">
        {cards.map((c) => {
          const selected = source === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={Boolean(c.off)}
              onClick={() => setSource(selected ? null : c.key)}
              className={cn(
                "flex items-start gap-3 rounded-lg p-4 text-left disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "bg-cta text-cta-foreground"
                  : "bg-secondary hover:bg-accent",
              )}
            >
              <c.icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{c.title}</span>
                <span
                  className={cn(
                    "block text-xs",
                    selected ? "text-cta-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {c.off ?? c.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {source === "ai" && (
        <HeroAiPanel
          groupId={groupId}
          heroId={heroId}
          configured={aiConfigured}
          defaultTheme={defaultTheme}
          defaultProducts={defaultProducts}
          onUse={onImages}
        />
      )}
      {source === "upload" && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm text-pretty">
            Компьютер: өргөн зураг (2.8:1), бараа баруун талд, зүүн тал хоосон
            хана. Утас: 4:3.
          </p>
          {/* Хоёр урьдчилсан зураг ижил өндөртэй: 2.8:1 ба 4:3. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <ImageUpload
              kind="desktop"
              label="Компьютер"
              groupId={groupId}
              preview={desktopImage ? `${desktopImage.base}-1600.webp` : null}
              onUploaded={(r) => onImages({ desktop: r.desktop, suggestDark: r.suggestDark })}
            />
            <ImageUpload
              kind="mobile"
              label="Утас"
              groupId={groupId}
              preview={mobileImage?.src ?? null}
              onUploaded={(r) => onImages({ mobile: r.mobile, suggestDark: r.suggestDark })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
