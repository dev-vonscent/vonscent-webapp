"use client";

import * as React from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { useFeatureFlag } from "@/components/feature-flags";
import type { ProductOption } from "@/features/admin/lib/product-option";
import { HeroCanvasEditor } from "@/features/heroes/components/hero-canvas-editor";
import { heroLinkOptions } from "@/features/heroes/link-presets";
import { guessHeroTheme } from "@/features/heroes/theme-guess";
import { HERO_AI_MAX_PRODUCTS } from "@/lib/ai/hero-prompt";
import type { SaleEventProduct } from "../../types";
import { effectiveCanvas } from "./studio-banner";
import type { EventStudio } from "./use-event-studio";

/**
 * ④ Нүүрний баннер (studio-ux.md §5.4, D3, D6): баннерыг энд, текстийг нь
 * баннер дээр нь засна. Хугацаа, нийтлэлт нь арга хэмжээнийх; тусдаа
 * «Нийтлэх» байхгүй. Юу ч өөрчлөхгүй бол баннер үүсэхгүй.
 */
export function StepBanner({
  studio,
  products,
  others,
  aiConfigured,
}: {
  studio: EventStudio;
  products: SaleEventProduct[];
  others: number;
  aiConfigured: boolean;
}) {
  const { draft, banner, bannerError, mode } = studio;
  const giftCards = useFeatureFlag("gift_cards");
  const canvas = effectiveCanvas(banner, draft);
  const linkOptions = React.useMemo(
    () =>
      heroLinkOptions({
        eventSlug: draft.slug,
        isEnabled: (flag) => flag === "gift_cards" && giftCards,
      }),
    [draft.slug, giftCards],
  );
  // AI-д урьдчилж: ②-т сонгосон эхний 3 үнэртэн (§5.4).
  const defaultProducts = React.useMemo<ProductOption[]>(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return draft.items
      .map((i) => byId.get(i.productId))
      .filter((p): p is SaleEventProduct => Boolean(p))
      .slice(0, HERO_AI_MAX_PRODUCTS)
      .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        isActive: true,
        availableMl: 0,
        priceByMl: p.prices,
      }));
  }, [draft.items, products]);
  const locked = mode === "locked";

  return (
    <div className="space-y-6">
      {bannerError && (
        <p
          className="bg-destructive/10 text-destructive rounded-lg px-4 py-2.5 text-sm"
          role="alert"
        >
          Баннер хадгалагдсангүй — {bannerError} Арга хэмжээ өөрөө хадгалагдсан;
          засаад дахин хадгална уу.
        </p>
      )}
      {!locked && (
        <label className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={banner.skip}
            onCheckedChange={(v) => studio.setBannerSkip(v === true, canvas)}
          />
          Энэ арга хэмжээнд баннер хэрэггүй
        </label>
      )}
      {banner.skip ? (
        <p className="bg-card text-muted-foreground rounded-lg px-6 py-12 text-center text-sm text-pretty">
          Нүүр хуудасны баннер солигдохгүй.
          {banner.id && " Хийсэн баннер хадгалагдсан хэвээр."}
        </p>
      ) : (
        <HeroCanvasEditor
          value={canvas}
          onChange={studio.setBanner}
          linkOptions={linkOptions}
          groupId={banner.groupId}
          heroId={banner.id}
          aiConfigured={aiConfigured}
          defaultTheme={guessHeroTheme(draft.name, draft.startsOn)}
          defaultProducts={defaultProducts}
          altPlaceholder={`Хоосон бол «${draft.name.trim() || "Арга хэмжээ"} — нүүрний баннер»`}
          disabled={locked}
        />
      )}

      {others > 0 && (
        <p className="text-muted-foreground text-sm">
          Энэ арга хэмжээнд өөр {others} баннер холбоотой байна —{" "}
          <Link
            href="/admin/heroes"
            className="text-foreground underline underline-offset-4"
          >
            «Нүүрний баннер» хуудсанд
          </Link>{" "}
          харна уу.
        </p>
      )}
    </div>
  );
}
