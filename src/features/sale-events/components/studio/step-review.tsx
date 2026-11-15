"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
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
import { ML_SIZES, SEASON_LABEL } from "@/lib/constants";
import type { SaleEventProduct } from "../../types";
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
  dayWithWeekday,
  daysInclusive,
  discountRange,
  isValidPct,
  pctSpan,
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
  products,
  heroes,
  heroEvents,
  onGo,
}: {
  studio: EventStudio;
  products: SaleEventProduct[];
  /** Бүх баннер, арга хэмжээ — дуусах мөчид аль нь гарахыг тооцоход. */
  heroes: HeroAdminRow[];
  heroEvents: HeroEventOption[];
  onGo: (step: StudioStep) => void;
}) {
  const { draft, phase, mode, checklist, busy, published, today } = studio;
  const summary = studio.bannerSummary;
  const ready = studio.bannerEnabled && bannerReady(summary);
  // Дуусах мөчид (exclusive хил) энэ арга хэмжээний баннергүйгээр аль нь гарах вэ.
  const bannerAfter = React.useMemo(() => {
    const end =
      studio.endsAt && phase === "ended"
        ? studio.endsAt
        : dayEndIso(draft.endsOn);
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
  const issues = checklist.filter((i) => i.level !== "ok");
  const locked = mode === "locked";
  const range = discountRange(draft.items);
  const span = pctSpan(range);
  const byId = new Map(products.map((p) => [p.id, p]));
  const days =
    draft.startsOn && draft.endsOn && draft.endsOn >= draft.startsOn
      ? daysInclusive(draft.startsOn, draft.endsOn)
      : null;
  const bannerFact = !studio.bannerEnabled
    ? null
    : studio.banner.skip
      ? "Баннер хэрэггүй"
      : ready
        ? "Бэлэн"
        : summary
          ? "Дутуу"
          : "Хийгээгүй";

  return (
    <div className="max-w-3xl space-y-8">
      {published && (
        <div role="status" className="bg-success/10 space-y-3 rounded-lg p-5">
          <div className="flex items-center gap-3">
            <span className="bg-success text-background inline-flex size-8 items-center justify-center rounded-full">
              <Check className="size-4" strokeWidth={2.5} />
            </span>
            <p className="text-lg font-semibold">
              {published === "schedule"
                ? `Товлогдлоо. ${shortDay(draft.startsOn)}-нд өөрөө эхэлнэ.`
                : "Эхэллээ. Хямдрал одоо дэлгүүрт үйлчилж байна."}
            </p>
          </div>
          <div className="bg-background/60 flex flex-wrap items-center gap-2 rounded-md py-1.5 pr-1.5 pl-3">
            <span className="min-w-0 flex-1 basis-40 text-sm break-all">
              {link.display}
            </span>
            <Button
              type="button"
              size="sm"
              className={STUDIO_CTA}
              onClick={copyLink}
            >
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
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-lg px-4 py-3",
            blocked ? "bg-destructive/10" : "bg-success/10",
          )}
        >
          {blocked ? (
            <CircleX
              className="text-destructive mt-0.5 size-4 shrink-0"
              aria-hidden
            />
          ) : (
            <Check
              className="text-success mt-0.5 size-4 shrink-0"
              aria-hidden
            />
          )}
          <div className="min-w-0 space-y-0.5">
            <p
              className={cn(
                "text-sm font-semibold",
                blocked && "text-destructive",
              )}
            >
              {blocked
                ? `Нийтлэхийн өмнө ${problems} зүйл засна`
                : "Нийтлэхэд бэлэн"}
            </p>
            <p className="text-muted-foreground text-sm text-pretty">
              {blocked
                ? "Доорх улаан мөрийн «Засах» дээр дарвал тухайн алхам руу очно."
                : action === "schedule"
                  ? `«${PUBLISH_LABEL[action]}» дарвал ${shortDay(draft.startsOn)}-нд өөрөө эхэлнэ. Хүртэл нь засаж болно.`
                  : `«${PUBLISH_LABEL[action]}» дармагц хямдрал дэлгүүрт шууд үйлчилнэ.`}
            </p>
          </div>
        </div>
      )}

      {/* Гол баримтууд — нэг харцаар. */}
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact
          label="Хугацаа"
          step="basics"
          locked={locked}
          onGo={onGo}
          value={
            draft.startsOn && draft.endsOn
              ? `${dayWithWeekday(draft.startsOn)} – ${dayWithWeekday(draft.endsOn)}`
              : "Огноо сонгоогүй"
          }
          sub={days ? `${days} хоног · 00:00–23:59` : undefined}
        />
        <Fact
          label="Бараа"
          step="products"
          locked={locked}
          onGo={onGo}
          value={
            range.count === 0
              ? "Сонгоогүй"
              : `${range.count} бараа${span ? ` · ${span} хямдрал` : ""}`
          }
          sub={range.noPct > 0 ? `${range.noPct} бараа хувьгүй` : undefined}
          danger={range.count === 0 || range.noPct > 0 || range.invalid > 0}
        />
        <Fact
          label="Холбоос"
          step="basics"
          locked={locked}
          onGo={onGo}
          value={<span className="break-all">{link.display}</span>}
          extra={
            draft.slug ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-8 rounded-full"
                aria-label="Холбоос хуулах"
                onClick={copyLink}
              >
                <Copy />
              </Button>
            ) : null
          }
        />
        {bannerFact ? (
          <Fact
            label="Нүүрний баннер"
            step="banner"
            locked={locked}
            onGo={onGo}
            value={bannerFact}
            danger={bannerFact === "Дутуу"}
            extra={
              summary?.thumb && !studio.banner.skip ? (
                // eslint-disable-next-line @next/next/no-img-element -- storage URL, админы thumbnail
                <img
                  src={summary.thumb}
                  alt=""
                  className="aspect-14/5 w-24 rounded-md object-cover"
                />
              ) : null
            }
          />
        ) : (
          <Fact
            label="Каталогийн текст"
            step="catalog"
            locked={locked}
            onGo={onGo}
            value={draft.headline.trim() || draft.name.trim() || "—"}
          />
        )}
      </dl>

      {issues.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Анхаарах зүйлс</h3>
          <ul role="list" className="space-y-1">
            {issues.map((item) => (
              <ChecklistRow
                key={`${item.step}:${item.text}`}
                item={item}
                readOnly={locked}
                onGo={onGo}
              />
            ))}
          </ul>
        </section>
      )}

      {draft.items.length > 0 && (
        <details
          className="group bg-card rounded-lg"
          open={draft.items.length <= 8}
        >
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold select-none">
            <span>
              Хямдрах бараа{" "}
              <span className="text-muted-foreground font-normal tabular-nums">
                {draft.items.length}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul role="list" className="space-y-0.5 px-2 pb-2">
            {draft.items.map((item) => {
              const p = byId.get(item.productId);
              const parts = ML_SIZES.filter((ml) =>
                isValidPct(item.pcts[ml] ?? ""),
              ).map((ml) => `${ml}ml −${item.pcts[ml]}%`);
              return (
                <li
                  key={item.productId}
                  className="odd:bg-secondary/40 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-md px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">
                      {p?.name ?? "Нуусан бараа"}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {p?.brand ?? "—"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      parts.length
                        ? "text-muted-foreground"
                        : "text-destructive",
                    )}
                  >
                    {parts.length ? parts.join(" · ") : "Хувьгүй"}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Юу болох вэ</h3>
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
              <div className="min-w-0 space-y-0.5 pb-5 text-sm">
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
                    className="mt-2 aspect-14/5 w-36 rounded-md object-cover"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {studio.bannerEnabled && studio.banner.draft && !studio.banner.skip && (
        <details className="group">
          <summary className="bg-secondary/50 hover:bg-secondary w-fit cursor-pointer rounded-md px-3 py-2 text-sm font-medium select-none">
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
        <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Арга хэмжээг зогсоох</p>
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
        "flex items-center gap-3 rounded-md py-1.5 pr-1.5 pl-3",
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

/** Тоймын нэг нүд: шошго, утга, «Засах». */
function Fact({
  label,
  value,
  sub,
  extra,
  step,
  locked,
  danger,
  onGo,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  extra?: React.ReactNode;
  step: StudioStep;
  locked: boolean;
  danger?: boolean;
  onGo: (step: StudioStep) => void;
}) {
  return (
    <div className="bg-card flex items-start gap-3 rounded-lg p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <dt className="text-muted-foreground text-[11px] font-medium tracking-[0.15em] uppercase">
          {label}
        </dt>
        <dd
          className={cn(
            "text-sm font-semibold text-pretty tabular-nums",
            danger && "text-destructive",
          )}
        >
          {value}
        </dd>
        {sub && (
          <dd className="text-muted-foreground text-xs tabular-nums">{sub}</dd>
        )}
      </div>
      {extra}
      {!locked && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -mt-1 -mr-2 h-8 px-2"
          aria-label={`${label} — засах`}
          onClick={() => onGo(step)}
        >
          Засах
        </Button>
      )}
    </div>
  );
}
