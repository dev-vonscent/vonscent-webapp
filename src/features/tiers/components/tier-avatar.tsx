"use client";

import Image from "next/image";
import type { UserTierKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TierFrame } from "./tier-frame";

/**
 * Хэрэглэгчийн дугуй зураг — түвшин мэдэгдэж байвал түвшний хүрээтэй
 * (сэтгэгдэл, цэс г.м.), үгүй бол (зочин, туг хаалттай) энгийн дугуй.
 * Хэмжээг `size` (px) — хүрээ нь түүнээс том тул эцэг элемент зай гаргана.
 */
export function TierAvatar({
  tier,
  src,
  name,
  size,
  className,
}: {
  tier?: UserTierKey | null;
  src: string | null;
  name: string;
  size: number;
  className?: string;
}) {
  const inner = src ? (
    <Image
      src={src}
      alt=""
      fill
      sizes={`${size}px`}
      unoptimized
      className="object-cover"
    />
  ) : (
    <span
      className="text-foreground flex h-full items-center justify-center font-semibold uppercase"
      style={{ fontSize: Math.round(size * 0.38) }}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );

  if (tier) {
    return (
      <TierFrame tier={tier} avatarSize={size} className={className}>
        {inner}
      </TierFrame>
    );
  }
  return (
    <span
      aria-label={name}
      className={cn(
        "bg-secondary relative block shrink-0 overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {inner}
    </span>
  );
}
