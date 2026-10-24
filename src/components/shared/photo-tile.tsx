"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Нэр нь зураг дээрээ бичигдсэн холбоос карт — каталог цэсний хүйс/улирал,
 * нүүрний товчлолууд. Нэр нь зураг дээр шууд цагаан бичгээр (quiz-ийн картын
 * хэв маяг). Gradient биш (design.md): зургийг жигд 20% харанхуйлж + бичигт
 * зөөлөн сүүдэр өгснөөр цайвар зураг дээр ч уншигдана; hover-т харанхуйлалт
 * арилна. Хэмжээг (`h-*` / `aspect-*`) дуудагч `className`-оор өгнө.
 *
 * `revealColor`: зураг анх хар цагаан (`grayscale` filter), hover/focus дээр
 * өнгө рүүгээ зөөлөн шилжинэ — нэг л өнгөт эх зураг тул хоёр хувилбар
 * давхцах асуудалгүй. Тиймээс энд өгөх зураг ӨНГӨТ байх ёстой.
 *
 * Утсан дээр hover байхгүй тул дармагц (`pointerdown`) өнгөтэй болж, хуудас
 * шилжтэл тэр хэвээр (`data-pressed`). CSS `:active` хангалтгүй: хуруу
 * авмагц алга болж, шинэ хуудас ачаалах зуур буцаад саарал болдог.
 * Гүйлгэх гэж хуруу тавьсан бол браузер `pointercancel` илгээнэ → буцаана.
 */
export function PhotoTile({
  href,
  src,
  label,
  sizes,
  className,
  imageClassName,
  labelClassName,
  revealColor = false,
}: {
  href: string;
  src: string;
  label: string;
  sizes: string;
  className?: string;
  /** E.g. `object-[50%_20%]` — нүүрийг тайрахгүйн тулд. */
  imageClassName?: string;
  labelClassName?: string;
  revealColor?: boolean;
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Link
      href={href}
      data-pressed={pressed || undefined}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") setPressed(true);
      }}
      onPointerCancel={() => setPressed(false)}
      // touch-callout: iOS дээр удаан дарахад картыг preview болгож ардаа
      // цагаан/саарал тавцан зурдаг — product card-тай ижил дүрэм.
      className={cn(
        // will-change-transform: карт бүр өөрийн давхаргатай — нэгнийх нь
        // hover шилжилт нөгөөг нь дахин зуруулж анивчуулахгүй.
        "group bg-muted relative block overflow-hidden rounded-xl will-change-transform [-webkit-touch-callout:none]",
        className,
      )}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className={cn(
          "object-cover transition-[filter] duration-700 ease-out motion-reduce:transition-none",
          // will-change: filter-ийн animation дуусахад Chrome давхаргыг
          // (compositor layer) буулгаж зургийг дахин зурдаг — дараагийн карт
          // руу шилжихэд өмнөх нь нэг анивчдаг байсан. Давхаргыг байнга барина.
          revealColor &&
            "grayscale will-change-[filter] group-hover:grayscale-0 group-focus-visible:grayscale-0 group-data-pressed:grayscale-0 group-data-pressed:duration-300",
          imageClassName,
        )}
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-black/20 transition-colors duration-500 group-hover:bg-black/5 group-focus-visible:bg-black/5 group-data-pressed:bg-black/5 group-data-pressed:duration-300 motion-reduce:transition-none"
      />
      <span
        className={cn(
          "absolute bottom-2.5 left-3 text-[15px] font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]",
          labelClassName,
        )}
      >
        {label}
      </span>
    </Link>
  );
}
