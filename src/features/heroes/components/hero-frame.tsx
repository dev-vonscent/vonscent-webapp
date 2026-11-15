"use client";

import * as React from "react";
import type { HomeCampaign } from "@/features/marketing/home-content";
import type { HeroField } from "../canvas-model";
import {
  HERO_PREVIEW_EDIT,
  HERO_PREVIEW_FOCUS,
  HERO_PREVIEW_MESSAGE,
  HERO_PREVIEW_SIZE,
  type HeroFrameEdit,
} from "./hero-preview-frame";

/**
 * Жинхэнэ `CampaignHero`-г тодорхой өргөнд (`/admin/hero-preview` iframe —
 * breakpoint нь viewport-оор), эх контейнерт багтаахаар scale-тэй.
 * `edit` өгвөл текстийг iframe дотор нь засна (studio-ux.md §6.3).
 */
export function HeroFrame({
  width,
  title,
  campaign,
  edit = null,
  onEdit,
  onFocusField,
  onTitleLines,
}: {
  width: number;
  title: string;
  campaign: HomeCampaign;
  edit?: Omit<HeroFrameEdit, "scale"> | null;
  onEdit?: (field: HeroField, value: string) => void;
  onFocusField?: (field: HeroField | null) => void;
  onTitleLines?: (n: number) => void;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(Math.round(width / 2.4));
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const send = React.useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        type: HERO_PREVIEW_MESSAGE,
        campaign,
        edit: edit ? { ...edit, scale } : null,
      },
      window.location.origin,
    );
  }, [campaign, edit, scale]);

  // Callback-ууд render бүрт шинэ байж болно — listener-ийг дахин холбохгүй.
  const handlers = React.useRef({ onEdit, onFocusField, onTitleLines, send });
  React.useEffect(() => {
    handlers.current = { onEdit, onFocusField, onTitleLines, send };
  });

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as {
        type?: string;
        ready?: boolean;
        height?: number;
        titleLines?: number;
        field?: HeroField | null;
        value?: string;
      };
      const h = handlers.current;
      if (d?.type === HERO_PREVIEW_SIZE) {
        if (d.ready) h.send();
        if (d.height) setHeight(d.height);
        if (d.titleLines != null) h.onTitleLines?.(d.titleLines);
      } else if (d?.type === HERO_PREVIEW_EDIT && d.field && d.value != null) {
        h.onEdit?.(d.field, d.value);
      } else if (d?.type === HERO_PREVIEW_FOCUS) {
        h.onFocusField?.(d.field ?? null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  React.useEffect(() => send(), [send]);

  return (
    <div
      ref={boxRef}
      className="overflow-hidden rounded-md"
      style={{ height: Math.ceil(height * scale) }}
    >
      <iframe
        ref={frameRef}
        src="/admin/hero-preview"
        title={title}
        width={width}
        height={height}
        className="origin-top-left border-0"
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}
