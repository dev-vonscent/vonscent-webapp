"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Check, CircleX, Copy, Info, Square } from "lucide-react";
import { dayEndIso } from "@/features/admin/lib/date-range";
import { canvasPreview } from "@/features/heroes/canvas-model";
import { HeroFrame } from "@/features/heroes/components/hero-frame";
import { heroAt } from "@/features/heroes/lib";
import type { HeroAdminRow, HeroEventOption } from "@/features/heroes/types";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  bannerReady,
  hasBlocking,
  type ChecklistItem,
  type ChecklistLevel,
} from "./studio-checklist";
import {
  PUBLISH_LABEL,
  publishAction,
  saleLink,
  shortDay,
  studioTimeline,
  type StudioStep,
} from "./studio-model";
import { effectiveCanvas } from "./studio-banner";
import type { EventStudio } from "./use-event-studio";

const ALL_SIZES = [
  { width: 390, label: "Утас 390" },
  { width: 768, label: "Таблет 768" },
  { width: 1440, label: "Компьютер 1440" },
] as const;

const LEVEL_ICON: Record<
  ChecklistLevel,
  { icon: typeof Check; className: string; label: string }
> = {
  ok: { icon: Check, className: "text-success", label: "Бэлэн" },
  note: { icon: Info, className: "text-muted-foreground", label: "Мэдээлэл" },
  warn: { icon: AlertCircle, className: "text-warning", label: "Анхаар" },
  error: { icon: CircleX, className: "text-destructive", label: "Засах" },
};

/**
 * ⑤ Шалгаад нийтлэх (studio-ux.md §5.5): юу болохын шугам, шалгах зүйлс,
 * нийтлэх. Товлосон / явж буй арга хэмжээнд тойм хуудас + «Зогсоох».
 */
export function StepReview({
  studio,
  heroes,
  heroEvents,
  onGo,
  onLeave,
}: {
  studio: EventStudio;
  /** Бүх баннер, арга хэмжээ — дуусах мөчид аль нь гарахыг тооцоход. */
  heroes: HeroAdminRow[];
  heroEvents: HeroEventOption[];
  onGo: (step: StudioStep) => void;
  /** Жагсаалт руу (хадгалаагүй өөрчлөлтийг эцэг нь шалгана). */
  onLeave: () => void;
}) {
  const { draft, phase, mode, checklist, busy, published, today } = studio;
  const summary = studio.bannerSummary;
  const ready = studio.bannerEnabled && bannerReady(summary);
  // Дуусах мөчид (exclusive хил) энэ арга хэмжээний баннергүйгээр аль нь гарах вэ.
  const bannerAfter = React.useMemo(() => {
    const end = studio.endsAt && phase === "ended" ? studio.endsAt : dayEndIso(draft.endsOn);
    if (!end) return undefined;
    const others = heroes.filter((h) => h.saleEventId !== studio.id);
    return heroAt(others, heroEvents, Date.parse(end) + 1)?.name ?? null;
  }, [heroes, heroEvents, studio.id, studio.endsAt, phase, draft.endsOn]);
  const timeline = studioTimeline({
    draft,
    phase,
    bannerReady: ready,
    endsAt: studio.endsAt,
    bannerThumb: summary?.thumb,
    bannerAfter,
  });
  const preview = React.useMemo(
    () => canvasPreview(effectiveCanvas(studio.banner, draft), "view").campaign,
    [studio.banner, draft],
  );
  const action = publishAction(draft.startsOn, today);
  const blocked = hasBlocking(checklist);
  const link = saleLink(draft.slug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Холбоос хуулагдлаа.");
    } catch {
      toast.error("Хуулж чадсангүй — холбоосыг гараар сонгож хуулна уу.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {published && (
        <div
          role="status"
          className="bg-success/10 space-y-3 rounded-lg p-4 sm:p-5"
        >
          <p className="font-medium">
            {published === "schedule"
              ? `Товлогдлоо. ${shortDay(draft.startsOn)}-нд өөрөө эхэлнэ.`
              : "Эхэллээ. Хямдрал одоо дэлгүүрт үйлчилж байна."}
          </p>
          <p className="text-muted-foreground text-sm break-all">
            {link.display}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              <Copy />
              Холбоос хуулах
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/sale-events">Жагсаалт руу</Link>
            </Button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Юу болох вэ</h2>
        <ol>
          {timeline.map((node, i) => (
            <li key={node.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-3 shrink-0 rounded-full",
                    node.current
                      ? "bg-cta ring-cta/30 ring-4"
                      : "bg-muted-foreground/50",
                  )}
                />
                {i < timeline.length - 1 && (
                  <span
                    aria-hidden
                    className="bg-muted-foreground/30 mt-1.5 w-px flex-1"
                  />
                )}
              </div>
              <div className="min-w-0 pb-5">
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    !node.current && "text-muted-foreground",
                  )}
                >
                  {node.when}
                </p>
                {node.lines.map((line) => (
                  <p key={line} className="text-sm text-pretty">
                    {line}
                  </p>
                ))}
                {node.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- storage URL, админы thumbnail
                  <img
                    src={node.image}
                    alt=""
                    className="mt-2 aspect-14/5 w-40 rounded-md object-cover"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Шалгах зүйлс</h2>
        <ul role="list" className="bg-card divide-border divide-y rounded-lg">
          {checklist.map((item) => (
            <ChecklistRow
              key={`${item.step}:${item.text}`}
              item={item}
              readOnly={mode === "locked"}
              onGo={onGo}
            />
          ))}
        </ul>
      </section>

      {studio.bannerEnabled && studio.banner.draft && !studio.banner.skip && (
        <details className="group space-y-3">
          <summary className="cursor-pointer text-sm font-medium select-none">
            Баннерыг бүх хэмжээгээр харах
          </summary>
          <div className="mt-3 space-y-4">
            {ALL_SIZES.map((s) => (
              <div key={s.width} className="space-y-1">
                <p className="text-muted-foreground text-xs">{s.label}</p>
                <div className="bg-secondary rounded-md p-1">
                  <HeroFrame
                    width={s.width}
                    title={`Баннер — ${s.label}`}
                    campaign={preview}
                  />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {mode === "auto" && (
        <div className="space-y-2">
          {blocked && (
            <p className="text-destructive text-sm" role="alert">
              Улаанаар тэмдэглэсэн зүйлсийг зассаны дараа нийтэлнэ.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onLeave}>
              Ноорог хэвээр үлдээх
            </Button>
            <LoadingButton
              type="button"
              loading={busy === "publish"}
              disabled={blocked || busy !== null}
              onClick={() => void studio.publish()}
            >
              {PUBLISH_LABEL[action]}
            </LoadingButton>
          </div>
        </div>
      )}

      {mode === "manual" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm text-pretty">
            {phase === "live"
              ? "Зогсоовол үнэ яг одоо буцна. Арга хэмжээ түүхэнд үлдэнэ."
              : "Зогсоовол ноорог руу буцна — дэлгүүрт юу ч өөрчлөгдөхгүй."}
          </p>
          <LoadingButton
            type="button"
            variant="outline"
            loading={busy === "stop"}
            disabled={busy !== null}
            onClick={() => void studio.stop()}
          >
            <Square />
            Зогсоох
          </LoadingButton>
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  readOnly,
  onGo,
}: {
  item: ChecklistItem;
  readOnly: boolean;
  onGo: (step: StudioStep) => void;
}) {
  const { icon: Icon, className, label } = LEVEL_ICON[item.level];
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className={cn("size-4 shrink-0", className)} aria-hidden />
      <span className="sr-only">{label}:</span>
      <span
        className={cn(
          "min-w-0 flex-1 text-sm text-pretty",
          item.level === "error" && "text-destructive",
        )}
      >
        {item.text}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onGo(item.step)}
      >
        {readOnly ? "Харах" : item.action}
      </Button>
    </li>
  );
}
