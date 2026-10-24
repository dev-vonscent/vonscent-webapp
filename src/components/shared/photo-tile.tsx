"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PRESS_DELAY_MS = 90;

/**
 * Нэр нь зураг дээрээ бичигдсэн холбоос карт — каталог цэсний хүйс/улирал,
 * нүүрний товчлолууд. Нэр нь зураг дээр шууд цагаан бичгээр (quiz-ийн картын
 * хэв маяг). Gradient биш (design.md): зургийг жигд 20% харанхуйлж + бичигт
 * зөөлөн сүүдэр өгснөөр цайвар зураг дээр ч уншигдана; hover-т харанхуйлалт
 * арилна. Хэмжээг (`h-*` / `aspect-*`) дуудагч `className`-оор өгнө.
 *
 * `revealColor`: зураг анх хар цагаан, hover/focus дээр өнгө рүүгээ зөөлөн
 * шилжинэ. `filter`-ийг animate хийвэл утсан дээр (iOS Safari) кадр бүрт
 * зургийг дахин зурж гацдаг тул саарал зургийн дээр ижил src-тэй өнгөт
 * давхарга тавьж зөвхөн `opacity`-г шилжүүлнэ (compositor дээр жигд). Ижил
 * src/sizes тул браузер нэг л удаа татна. Энд өгөх зураг ӨНГӨТ байх ёстой.
 *
 * Утсан дээр hover байхгүй тул дарахад өнгөтэй болж, хуудас шилжтэл тэр
 * хэвээр (`data-pressed`). CSS `:active` хангалтгүй: хуруу авмагц алга болж,
 * шинэ хуудас ачаалах зуур буцаад саарал болдог. `pointerdown`-оос
 * `PRESS_DELAY_MS` хүлээнэ — гүйлгэх гэж хуруу тавьсан бол браузер тэр
 * хооронд `pointercancel` илгээж, өнгө анивчихгүй. Хурдан товшилтод `click`
 * шууд асаана.
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
  const pressTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(pressTimer.current), []);
  const cancelPress = () => {
    window.clearTimeout(pressTimer.current);
    setPressed(false);
  };
  const imageClass = cn("object-cover", imageClassName);
  return (
    <Link
      href={href}
      data-pressed={pressed || undefined}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        window.clearTimeout(pressTimer.current);
        pressTimer.current = window.setTimeout(
          () => setPressed(true),
          PRESS_DELAY_MS,
        );
      }}
      onPointerCancel={cancelPress}
      onClick={(e) => {
        window.clearTimeout(pressTimer.current);
        // Шинэ таб (cmd/ctrl-click) энэ хуудсыг орхихгүй — өнгө үлдээхгүй.
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) setPressed(true);
      }}
      // touch-callout: iOS дээр удаан дарахад картыг preview болгож ардаа
      // цагаан/саарал тавцан зурдаг — product card-тай ижил дүрэм.
      // draggable: iOS Safari холбоос/зургийг чирэх (drag lift) эхлүүлэхдээ
      // картыг саарал тавцан дээр томруулж харанхуйлдаг — touch-callout
      // үүнийг хаадаггүй.
      draggable={false}
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
        draggable={false}
        sizes={sizes}
        className={cn(imageClass, revealColor && "grayscale")}
      />
      {revealColor && (
        <Image
          src={src}
          alt=""
          aria-hidden
          fill
          draggable={false}
          sizes={sizes}
          className={cn(
            imageClass,
            // will-change: animation дуусахад Chrome давхаргыг буулгаж нэг
            // анивчуулдаг — давхаргыг байнга барина.
            "opacity-0 transition-opacity duration-500 ease-out will-change-[opacity] group-hover:opacity-100 group-focus-visible:opacity-100 group-data-pressed:opacity-100 group-data-pressed:duration-300 motion-reduce:transition-none",
          )}
        />
      )}
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
