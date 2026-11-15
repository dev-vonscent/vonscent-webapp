"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CircleX,
  Copy,
  Info,
  Square,
} from "lucide-react";
import { dayEndIso } from "@/features/admin/lib/date-range";
import { canvasPreview } from "@/features/heroes/canvas-model";
import { HeroFrame } from "@/features/heroes/components/hero-frame";
import { heroAt } from "@/features/heroes/lib";
import type { HeroAdminRow, HeroEventOption } from "@/features/heroes/types";
import { SEASON_LABEL } from "@/lib/constants";
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
  STUDIO_CTA,
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
    const h = heroAt(others, heroEvents, Date.parse(end) + 1);
    if (!h) return null;
    return h.season
      ? `«${SEASON_LABEL[h.season]}» улирлын баннер`
      : `«${h.name}» баннер`;
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

  const problems = checklist.filter((i) => i.level === "error").length;

  return (
    <div className="max-w-3xl space-y-12">
      {published && (
        <div role="status" className="bg-success/10 space-y-4 rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="bg-success text-background inline-flex size-9 items-center justify-center rounded-full">
              <Check className="size-5" strokeWidth={2.5} />
            </span>
            <p className="font-serif text-xl font-semibold">
              {published === "schedule"
                ? `Товлогдлоо. ${shortDay(draft.startsOn)}-нд өөрөө эхэлнэ.`
                : "Эхэллээ. Хямдрал одоо дэлгүүрт үйлчилж байна."}
            </p>
          </div>
          <div className="bg-background/60 flex flex-wrap items-center gap-2 rounded-xl py-2 pr-2 pl-4">
            <span className="min-w-0 flex-1 basis-40 text-sm break-all">
              {link.display}
            </span>
            <Button type="button" size="sm" className={STUDIO_CTA} onClick={copyLink}>
              <Copy />
              Холбоос хуулах
            </Button>
          </div>
          <Link
            href="/admin/sale-events"
            className="text-muted-foreground hover:text-foreground inline-block text-sm underline underline-offset-4"
          >
            Жагсаалт руу буцах
          </Link>
        </div>
      )}

      {mode === "auto" && !published && (
        <div
          className={cn(
            "space-y-5 rounded-3xl p-6",
            blocked ? "bg-destructive/10" : "bg-secondary/60",
          )}
        >
          <div className="space-y-1">
            <p className="font-serif text-xl font-semibold">
              {blocked
                ? `Нийтлэхийн өмнө ${problems} зүйл засна`
                : "Нийтлэхэд бэлэн"}
            </p>
            <p className="text-muted-foreground text-sm text-pretty">
              {blocked
                ? "Доорх улаан мөрийн «Засах» дээр дарвал тухайн алхам руу очно."
                : action === "schedule"
                  ? `${shortDay(draft.startsOn)}-нд өөрөө эхэлнэ. Хүртэл нь засаж болно.`
                  : "Нийтэлмэгц хямдрал дэлгүүрт шууд үйлчилнэ."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LoadingButton
              type="button"
              size="lg"
              className={STUDIO_CTA}
              loading={busy === "publish"}
              disabled={blocked || busy !== null}
              onClick={() => void studio.publish()}
            >
              {PUBLISH_LABEL[action]}
            </LoadingButton>
            <Button type="button" size="lg" variant="ghost" onClick={onLeave}>
              Ноорог хэвээр үлдээх
            </Button>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <h3 className="font-serif text-xl font-semibold">Шалгах зүйлс</h3>
        <ul role="list" className="space-y-1.5">
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

      <section className="space-y-5">
        <h3 className="font-serif text-xl font-semibold">Юу болох вэ</h3>
        <ol>
          {timeline.map((node, i) => (
            <li key={node.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 size-3 shrink-0 rounded-full",
                    node.current
                      ? "bg-cta ring-cta/25 ring-4"
                      : "bg-muted-foreground/40",
                  )}
                />
                {i < timeline.length - 1 && (
                  <span
                    aria-hidden
                    className="bg-secondary mt-2 w-0.5 flex-1 rounded-full"
                  />
                )}
              </div>
              <div className="min-w-0 space-y-1 pb-8">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    !node.current && "text-muted-foreground",
                  )}
                >
                  {node.when}
                </p>
                {node.lines.map((line) => (
                  <p key={line} className="text-pretty">
                    {line}
                  </p>
                ))}
                {node.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- storage URL, админы thumbnail
                  <img
                    src={node.image}
                    alt=""
                    className="mt-3 aspect-14/5 w-48 rounded-xl object-cover"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {studio.bannerEnabled && studio.banner.draft && !studio.banner.skip && (
        <details className="group">
          <summary className="bg-secondary/50 hover:bg-secondary w-fit cursor-pointer rounded-xl px-4 py-3 text-sm font-medium select-none">
            Баннерыг бүх хэмжээгээр харах
          </summary>
          <div className="mt-4 space-y-6">
            {ALL_SIZES.map((s) => (
              <div key={s.width} className="space-y-2">
                <p className="text-muted-foreground text-xs">{s.label}</p>
                <div className="bg-secondary/50 rounded-2xl p-2">
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

      {mode === "manual" && (
        <div className="bg-secondary/50 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
          <div className="space-y-1">
            <p className="font-medium">Арга хэмжээг зогсоох</p>
            <p className="text-muted-foreground text-sm text-pretty">
              {phase === "live"
                ? "Үнэ яг одоо буцна. Арга хэмжээ түүхэнд үлдэнэ."
                : "Ноорог руу буцна — дэлгүүрт юу ч өөрчлөгдөхгүй."}
            </p>
          </div>
          <LoadingButton
            type="button"
            variant="secondary"
            className="text-destructive"
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
  const isError = item.level === "error";
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl py-2.5 pr-2 pl-4",
        isError ? "bg-destructive/10" : "bg-secondary/40",
      )}
    >
      <Icon className={cn("size-4 shrink-0", className)} aria-hidden />
      <span className="sr-only">{label}:</span>
      <span
        className={cn(
          "min-w-0 flex-1 text-sm text-pretty",
          isError && "text-destructive font-medium",
        )}
      >
        {item.text}
      </span>
      <Button
        type="button"
        variant={isError ? "secondary" : "ghost"}
        size="sm"
        className={cn("shrink-0", !isError && "text-muted-foreground")}
        onClick={() => onGo(item.step)}
      >
        {readOnly ? "Харах" : item.action}
        <ArrowRight />
      </Button>
    </li>
  );
}
