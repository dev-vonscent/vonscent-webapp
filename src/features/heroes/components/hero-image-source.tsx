"use client";

import * as React from "react";
import { ImagePlus, Sparkles } from "lucide-react";
import type { ProductOption } from "@/features/admin/lib/product-option";
import type { HeroThemeKey } from "@/lib/ai/hero-prompt";
import { Tooltip } from "@/components/shared/tooltip";
import { cn } from "@/lib/utils";
import { generationIdOf } from "../lib";
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
  // Буцаж ирэхэд (студи алхам солиход дахин mount) зураг нь хаанаас ирснийг
  // сэргээнэ: AI ажлаас «Ашиглах»-аар бол AI хэсэг, өөрөө оруулсан бол
  // оруулах хэсэг нээлттэй.
  const [source, setSource] = React.useState<Source | null>(() => {
    if (
      aiConfigured &&
      (generationIdOf(desktopImage?.base) || generationIdOf(mobileImage?.src))
    ) {
      return "ai";
    }
    return desktopImage || mobileImage ? "upload" : null;
  });
  const tabs: {
    key: Source;
    icon: typeof Sparkles;
    title: string;
    off?: string;
  }[] = [
    {
      key: "ai",
      icon: Sparkles,
      title: "AI-аар үүсгэх",
      off: aiConfigured
        ? undefined
        : "AI-ийн түлхүүр тохируулаагүй — зургаа оруулна уу.",
    },
    { key: "upload", icon: ImagePlus, title: "Өөрөө оруулах" },
  ];
  const hint =
    source === "ai"
      ? "Сэдэв, үнэртнээ сонгоод 1–2 минутад."
      : source === "upload"
        ? "Компьютер 2.8:1 (бараа баруун талд), утас 4:3."
        : desktopImage || mobileImage
          ? "Зураг солих бол аль нэгийг сонгоно."
          : "Зургаа хаанаас авахаа сонгоно.";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="radiogroup"
          aria-label="Зураг"
          className="bg-secondary flex rounded-full p-0.5"
        >
          {tabs.map((t) => {
            const selected = source === t.key;
            const button = (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={Boolean(t.off)}
                onClick={() => setSource(selected ? null : t.key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "bg-cta text-cta-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" aria-hidden />
                {t.title}
              </button>
            );
            return t.off ? (
              <Tooltip key={t.key} content={t.off} align="start">
                {button}
              </Tooltip>
            ) : (
              <React.Fragment key={t.key}>{button}</React.Fragment>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>

      {source === "ai" && (
        <HeroAiPanel
          groupId={groupId}
          heroId={heroId}
          configured={aiConfigured}
          defaultTheme={defaultTheme}
          defaultProducts={defaultProducts}
          inUse={{
            desktop: generationIdOf(desktopImage?.base),
            mobile: generationIdOf(mobileImage?.src),
          }}
          onUse={onImages}
        />
      )}
      {source === "upload" && (
        <div className="space-y-2">
          {/* Хоёр урьдчилсан зураг ижил өндөртэй: 2.8:1 ба 4:3. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <ImageUpload
              kind="desktop"
              label="Компьютер"
              groupId={groupId}
              preview={desktopImage ? `${desktopImage.base}-1600.webp` : null}
              onUploaded={(r) =>
                onImages({ desktop: r.desktop, suggestDark: r.suggestDark })
              }
            />
            <ImageUpload
              kind="mobile"
              label="Утас"
              groupId={groupId}
              preview={mobileImage?.src ?? null}
              onUploaded={(r) =>
                onImages({ mobile: r.mobile, suggestDark: r.suggestDark })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
