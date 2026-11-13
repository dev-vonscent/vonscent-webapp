"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useFilterQuery } from "@/features/catalog/components/use-filter-query";
import { formatCountdown } from "../lib";
import type { SaleEventState } from "../types";

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
 * Каталогийн `?event=slug` зурвас (plan §6.1–§6.3). Нэг газар, нэг UI:
 *   · live      — гарчиг, тайлбар, «Дуусахад 2 өдөр 4 цаг»
 *   · scheduled — «2026.11.23-нд эхэлнэ» (хувь, жагсаалт байхгүй)
 *   · ended / олдохгүй — «Энэ урамшуулал дууссан» + одоо явж буйнууд
 * Хуучин холбоос (сошиал пост, `/sale/black-friday`) хоосон жагсаалт биш,
 * ойлгомжтой төлөвт хүрнэ; доор нь бүх каталог.
 */
export function SaleEventBanner(props: SaleEventBannerProps) {
  const { setSingle } = useFilterQuery();
  const clear = () => setSingle("event", undefined);
  const title =
    props.state === "live"
      ? props.headline?.trim() || props.name
      : props.state === "scheduled"
        ? props.name
        : "Энэ урамшуулал дууссан";

  return (
    <section
      aria-label="Урамшуулал"
      className="bg-secondary mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
    >
      <div className="min-w-0 space-y-1">
        <h2 className="font-serif text-lg font-semibold tracking-tight wrap-break-word sm:text-xl">
          {title}
        </h2>
        {props.state === "live" && props.description && (
          <p className="text-muted-foreground text-sm wrap-break-word">
            {props.description}
          </p>
        )}
        {props.state === "live" && props.showCountdown && props.endsAt && (
          <Countdown endsAt={props.endsAt} />
        )}
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
                  <Button key={e.slug} asChild size="sm" variant="outline">
                    <Link href={`/catalog?event=${e.slug}`}>{e.name}</Link>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 self-start"
        onClick={clear}
      >
        <X />
        {props.state === "live" ? "Бүх каталог" : "Хаах"}
      </Button>
    </section>
  );
}

/**
 * «Дуусахад 2 өдөр 4 цаг». Hydration зөрөхгүйн тулд mount-ийн дараа л
 * гарна. 0 болоход хуудсыг серверээс шинэчилнэ — хуудсаа нээлттэй орхисон
 * хэрэглэгч хуучин үнэ, chip-тэй үлдэхгүй (plan §10).
 */
function Countdown({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const end = Date.parse(endsAt);
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const left = now == null ? null : end - now;
  const ended = left != null && left <= 0;
  React.useEffect(() => {
    if (ended) router.refresh();
  }, [ended, router]);

  const text = left == null ? null : formatCountdown(left);
  if (!text) return null;
  return (
    <p className="text-foreground flex items-center gap-1.5 text-sm font-medium tabular-nums">
      <Clock className="size-4" aria-hidden />
      Дуусахад {text}
    </p>
  );
}
