"use client";

import * as React from "react";
import Image from "next/image";
import type { UserTierKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { tierByKey } from "../lib";
import { TierGem } from "./tier-gem";

export { TierGem };

/*
 * Түвшний хүрээ (клиент, 2026-10-19: клиентийн өгсөн зураг, 5 түвшин).
 *
 * `public/tiers/<tier>.v<N>.webp`, ил тод дэвсгэртэй. Зургийг солихдоо
 * хувилбарын дугаарыг ахиул — нэр ижил бол Next-ийн зургийн кэш ба CDN
 * хуучныг нь үзүүлсээр байна. Профайл зураг нь хүрээний
 * ДООР, голын нүхийг бүрэн хучих дугуйгаар байрлана — илүүдэл нь хүрээн
 * доор нуугдана. Хөдөлгөөн нь зурган дээр давхарлана: ар талын өнгөт
 * гэрэл, металл/чулуугаар гүйх ойлт, гялбаа (globals.css «tier-*»).
 */

interface FrameImage {
  src: string;
  /** Нүхний төв, зургийн өргөн/өндрийн хувиар. */
  cx: number;
  cy: number;
  /** Нүхийг хучих радиус, зургийн ӨРГӨНИЙ хувиар. */
  r: number;
  /** Өндөр / өргөн. */
  aspect: number;
  /** Ар талын гэрлийн өнгө; null = гэрэлгүй. */
  glow: string | null;
  /** Гялбааны байрлал (зургийн хувиар) — орой, чулуун дээр. */
  sparks: readonly (readonly [number, number])[];
}

/**
 * Хэмжилт нь эх зургаас (2026-10-19): нүхийг flood fill-ээр олж, bbox-ийн
 * төв ба хамгийн алс цэг хүртэлх зай. Зургийг солибол дахин хэмжинэ.
 * Түвшин ахих тусам гэрэл, гялбаа нэмэгдэнэ — Standard нь зөвхөн ойлттой.
 */
const FRAME_IMAGES: Record<UserTierKey, FrameImage> = {
  standard: {
    src: "/tiers/standard.v2.webp",
    cx: 0.5,
    cy: 0.4511,
    r: 0.3674,
    aspect: 0.9973,
    glow: null,
    sparks: [],
  },
  gold: {
    src: "/tiers/gold.v2.webp",
    cx: 0.4973,
    cy: 0.4988,
    r: 0.3631,
    aspect: 1.0796,
    glow: "rgb(255 190 60 / 0.3)",
    sparks: [[0.5, 0.06]],
  },
  platinum: {
    // v3 (2026-10-19): клиентийн хар дэвсгэртэй зургаас дэвсгэрийг арилгав.
    src: "/tiers/platinum.v3.webp",
    cx: 0.4991,
    cy: 0.5481,
    r: 0.3408,
    aspect: 1.0902,
    glow: "rgb(230 236 245 / 0.32)",
    sparks: [
      [0.5, 0.07],
      [0.5, 0.88],
    ],
  },
  sapphire: {
    src: "/tiers/sapphire.v2.webp",
    cx: 0.4987,
    cy: 0.5509,
    r: 0.3608,
    aspect: 1.2386,
    glow: "rgb(61 110 255 / 0.5)",
    sparks: [
      [0.5, 0.13],
      [0.5, 0.93],
      [0.06, 0.6],
      [0.93, 0.35],
    ],
  },
  ruby: {
    src: "/tiers/ruby.v2.webp",
    cx: 0.4987,
    cy: 0.5475,
    r: 0.3562,
    aspect: 1.2446,
    glow: "rgb(230 20 50 / 0.55)",
    sparks: [
      [0.49, 0.09],
      [0.49, 0.93],
      [0.05, 0.6],
      [0.94, 0.33],
      [0.3, 0.22],
    ],
  },
};

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

const SPARK_PATH =
  "M12 0C12.9 8 16 11.1 24 12C16 12.9 12.9 16 12 24C11.1 16 8 12.9 0 12C8 11.1 11.1 8 12 0Z";

export function TierFrame({
  tier,
  className,
  avatarSize,
  badge,
  children,
}: {
  tier: UserTierKey;
  /** Аватарын хэмжээ, px — өгвөл `--avatar`-ыг дарна (className-ээс хялбар). */
  avatarSize?: number;
  /**
   * Аватарын хэмжээг `[--avatar:88px]` маягаар өгнө (эцэг элементээс ч
   * удамшина; анхдагч 96px). Хүрээ нь түвшнээс хамаарч түүнээс том.
   */
  className?: string;
  /** Аватарын баруун доод буланд (ж: баталгаажсан тэмдэг). */
  badge?: React.ReactNode;
  /** Аватарын дугуй агуулга — бүтэн дүүргэнэ. */
  children: React.ReactNode;
}) {
  const frame = FRAME_IMAGES[tier];

  // Аватар = нүхний диаметр → хүрээний өргөн = аватар / (2r).
  const avatarBox: React.CSSProperties = {
    left: pct(frame.cx - frame.r),
    top: pct(frame.cy - frame.r / frame.aspect),
    width: pct(2 * frame.r),
    height: pct((2 * frame.r) / frame.aspect),
  };

  return (
    <span
      data-tier={tier}
      className={cn("relative inline-block shrink-0", className)}
      style={{
        ...(avatarSize != null &&
          ({ "--avatar": `${avatarSize}px` } as React.CSSProperties)),
        width: `calc(var(--avatar, 96px) / ${2 * frame.r})`,
        aspectRatio: `1 / ${frame.aspect}`,
      }}
    >
      {frame.glow && (
        <span
          aria-hidden
          className="tier-aura absolute rounded-full"
          style={{
            left: pct(frame.cx - frame.r * 1.35),
            top: pct(frame.cy - (frame.r * 1.35) / frame.aspect),
            width: pct(2.7 * frame.r),
            height: pct((2.7 * frame.r) / frame.aspect),
            background: frame.glow,
          }}
        />
      )}
      <span
        className="bg-secondary absolute overflow-hidden rounded-full"
        style={avatarBox}
      >
        {children}
      </span>
      <Image
        src={frame.src}
        alt=""
        aria-hidden
        fill
        sizes="(min-width: 640px) 240px, 180px"
        className="pointer-events-none object-contain select-none"
      />
      {/* Ойлт: зөвхөн хүрээний дүрсэн дээгүүр (маск = зураг өөрөө). */}
      <span
        aria-hidden
        className="tier-shimmer absolute inset-0"
        style={{
          maskImage: `url(${frame.src})`,
          WebkitMaskImage: `url(${frame.src})`,
        }}
      />
      {frame.sparks.map(([x, y], i) => (
        <svg
          key={i}
          aria-hidden
          viewBox="0 0 24 24"
          className="tier-spark absolute size-[14%] text-white"
          style={{
            left: pct(x),
            top: pct(y),
            animationDelay: `${(i * 0.9) % 3.6}s`,
          }}
        >
          <path d={SPARK_PATH} fill="currentColor" />
        </svg>
      ))}
      {badge && (
        <span className="absolute" style={avatarBox}>
          {badge}
        </span>
      )}
    </span>
  );
}

/** Нэрийн хажуугийн түвшний тэмдэг. */
export function TierBadge({
  tier,
  className,
}: {
  tier: UserTierKey;
  className?: string;
}) {
  const t = tierByKey(tier);
  return (
    <span
      className={cn(
        "border-border bg-secondary text-foreground inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1.5 text-xs font-medium",
        className,
      )}
    >
      <TierGem tier={tier} />
      {t.label}
    </span>
  );
}
