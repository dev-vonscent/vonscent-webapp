"use client";

import * as React from "react";
import {
  CampaignHero,
  staticHero,
} from "@/features/marketing/components/home/campaign-hero";
import type { HomeCampaign } from "@/features/marketing/home-content";

/** Эх цонх ↔ iframe мессеж. */
export const HERO_PREVIEW_MESSAGE = "vonscent:hero-preview";
export const HERO_PREVIEW_SIZE = "vonscent:hero-preview-size";

/**
 * iframe доторх hero. `campaign` ирэхэд зурж, өндөр болон гарчгийн мөрийн
 * тоог эх цонх руу буцаана (desktop-д 2 мөрөөс хэтэрвэл анхааруулга).
 * Зөвхөн ижил origin-оос ирсэн мессежийг хүлээж авна.
 */
export function HeroPreviewFrame() {
  const [campaign, setCampaign] = React.useState<HomeCampaign | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; campaign?: HomeCampaign };
      if (data?.type === HERO_PREVIEW_MESSAGE && data.campaign) {
        setCampaign(data.campaign);
      }
    }
    window.addEventListener("message", onMessage);
    // Бэлэн болсныг мэдэгдэнэ — эх цонх эхний өгөгдлөө илгээнэ.
    window.parent.postMessage(
      { type: HERO_PREVIEW_SIZE, ready: true },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const title = el.querySelector<HTMLElement>("#home-hero-title");
      const lineHeight = title
        ? parseFloat(getComputedStyle(title).lineHeight) || 1
        : 1;
      window.parent.postMessage(
        {
          type: HERO_PREVIEW_SIZE,
          height: Math.ceil(el.getBoundingClientRect().height),
          titleLines: title ? Math.round(title.offsetHeight / lineHeight) : 0,
        },
        window.location.origin,
      );
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [campaign]);

  if (!campaign || campaign.image.kind !== "static") return null;
  return (
    <div ref={ref} className="bg-background p-4 md:px-8">
      <CampaignHero hero={staticHero(campaign, campaign.image)} />
    </div>
  );
}
