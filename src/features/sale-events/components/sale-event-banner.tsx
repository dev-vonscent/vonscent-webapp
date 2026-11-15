"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useFilterQuery } from "@/features/catalog/components/use-filter-query";
import type { SaleEventState } from "../types";
import { SaleEventBannerView } from "./sale-event-banner-view";

export interface SaleEventBannerProps {
  slug: string;
  /** Олдохгүй / ноорог slug → `missing`. */
  state: SaleEventState | "missing";
  name: string | null;
  headline: string | null;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  showCountdown: boolean;
  /** «Дууссан» үед санал болгох одоо явж буй арга хэмжээнүүд. */
  otherLive: { slug: string; name: string }[];
}

/**
 * Каталогийн `?event=slug` төлөвийн зурвас (plan §6.2–§6.3):
 *   · live      — юу ч зурахгүй: гарчиг, тоолуур нь сайтын дээд гүйдэг
 *                 зурваст (`SaleEventTicker`, клиент 2026-11-15)
 *   · scheduled — «2026.11.23-нд эхэлнэ» (хувь, жагсаалт байхгүй)
 *   · ended / олдохгүй — «Энэ урамшуулал дууссан» + одоо явж буйнууд
 * Хуучин холбоос (сошиал пост, `/sale/black-friday`) хоосон жагсаалт биш,
 * ойлгомжтой төлөвт хүрнэ; доор нь бүх каталог.
 */
export function SaleEventBanner(props: SaleEventBannerProps) {
  const { setSingle } = useFilterQuery();
  if (props.state === "live") return null;
  const clear = () => setSingle("event", undefined);
  const title =
    props.state === "scheduled" ? props.name : "Энэ урамшуулал дууссан";

  return (
    <SaleEventBannerView
      title={title}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 self-start"
          onClick={clear}
        >
          <X />
          Хаах
        </Button>
      }
    >
      {props.state === "scheduled" && props.startsAt && (
        <p className="text-muted-foreground text-sm">
          {formatDate(props.startsAt)}-нд эхэлнэ. Удахгүй уулзъя!
        </p>
      )}
      {(props.state === "ended" || props.state === "missing") && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Доор бүх каталог харагдаж байна.
          </p>
          {props.otherLive.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {props.otherLive.map((e) => (
                <Button key={e.slug} asChild size="sm" variant="secondary">
                  <Link href={`/catalog?event=${e.slug}`}>{e.name}</Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </SaleEventBannerView>
  );
}
