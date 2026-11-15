"use client";

import Image from "next/image";
import { EditableText } from "@/features/admin/components/editable-text";
import {
  GENDER_LABEL,
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_LIMITS as L,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { eventPctText } from "../../lib";
import { SaleChip } from "../sale-badge";
import { TICKER_BAR, TickerSegment, TickerTimer } from "../sale-event-ticker";
import {
  PREVIEW_CARD_COUNT,
  previewBadge,
  type PreviewCard,
} from "./catalog-preview-model";

/** Дэлгүүрийн шүүлтүүрийн `Chip`-ийн класс (catalog-filters.tsx). */
const CHIP = "rounded-sm px-3 py-2 text-center text-sm font-medium";

/** Засагдах цэгийн дугаар — доорх тайлбарын жагсаалттай таарна. */
export function PreviewMarker({
  n,
  inverse = false,
}: {
  n: number;
  /** Дээд зурвасын (`announce`) дэвсгэр дээр — урвуу өнгө. */
  inverse?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        inverse
          ? "bg-announce-foreground text-announce"
          : "bg-cta text-cta-foreground",
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-sans text-[11px] leading-none font-semibold tracking-normal normal-case tabular-nums",
      )}
    >
      {n}
    </span>
  );
}

export interface CatalogPreviewProps {
  name: string;
  headline: string;
  badgeLabel: string;
  showCountdown: boolean;
  /** Дээд зурвасын өнгө (`[data-ticker]`, globals.css). */
  tickerTheme: SaleEventTickerTheme;
  /** Эхлэх мөчид үлдэх хугацаа (мс) — огноогүй бол null (7 хоног харуулна). */
  countdownMs: number | null;
  cards: PreviewCard[];
  nameInvalid?: boolean;
  disabled?: boolean;
  onName: (value: string) => void;
  onHeadline: (value: string) => void;
  onBadgeLabel: (value: string) => void;
  onShowCountdown: (value: boolean) => void;
  /** Бараа сонгоогүй үед ②-р алхам руу. */
  onPickProducts: () => void;
}

/**
 * Дэлгүүрийн жижигрүүлсэн, жинхэнэ төрхтэй хэсэг (studio-ux.md D4, §5.3):
 * сайтын дээд гүйдэг зурвас, каталогийн шүүлтүүрийн chip, эхний 4 бараа. Зөвхөн
 * харуулах компонент — live өгөгдөл ачаалахгүй; дэлгүүрийн `Chip`,
 * `TickerSegment`, `ProductCard`-ын класс, token-ыг дагана. Текст бүр
 * байгаа газраа засагдана (`EditableText`).
 */
export function CatalogPreview(p: CatalogPreviewProps) {
  const placeholders = Math.max(0, PREVIEW_CARD_COUNT - p.cards.length);
  // Засах цэгийн outline, шошго `cta` дэвсгэр дээр харагдах ёстой.
  const onBar = "outline-announce-foreground";
  return (
    <div className="bg-background shadow-lift rounded-3xl">
      {/* ── Сайтын дээд гүйдэг зурвас (дэлгүүрт хөдөлнө, энд зогсонги) ── */}
      <div
        data-ticker={p.tickerTheme}
        className={cn(
          TICKER_BAR,
          "h-auto min-h-12 overflow-visible rounded-t-3xl py-2.5",
        )}
      >
        <TickerSegment
          className="min-w-0 shrink flex-wrap gap-y-2 px-4 whitespace-normal sm:px-6"
          title={
            <span className="flex items-center gap-2">
              <PreviewMarker n={1} inverse />
              <EditableText
                value={p.headline}
                onChange={p.onHeadline}
                label="Зурвасын гарчиг"
                maxLength={L.headline}
                fallback={p.name.trim() || "Арга хэмжээний нэр"}
                disabled={p.disabled}
                className={onBar}
              />
            </span>
          }
          countdown={
            <span className="flex items-center gap-2">
              <PreviewMarker n={2} inverse />
              <button
                type="button"
                aria-pressed={p.showCountdown}
                aria-label="Дуусах тоолуур харуулах"
                title={
                  p.showCountdown
                    ? "Дарж тоолуурыг унтраана"
                    : "Дарж тоолуурыг асаана"
                }
                disabled={p.disabled}
                onClick={() => p.onShowCountdown(!p.showCountdown)}
                className={cn(
                  "rounded-xs uppercase outline-offset-4 hover:outline-1 focus-visible:outline-2 disabled:pointer-events-none",
                  onBar,
                  !p.showCountdown && "line-through opacity-50",
                )}
              >
                <TickerTimer ms={p.countdownMs ?? 7 * 86_400_000} />
              </button>
            </span>
          }
        />
      </div>

      <div className="space-y-5 p-4 sm:p-8">
        {/* ── Шүүлтүүр ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(CHIP, "bg-foreground text-background")}>
            Бүгд
          </span>
          <span className={cn(CHIP, "bg-secondary")}>{GENDER_LABEL.male}</span>
          <span className={cn(CHIP, "bg-secondary")}>
            {GENDER_LABEL.female}
          </span>
          <span
            className={cn(CHIP, "bg-secondary flex min-w-0 items-center gap-2")}
          >
            <PreviewMarker n={3} />
            <EditableText
              value={p.name}
              onChange={p.onName}
              label="Арга хэмжээний нэр"
              maxLength={L.name}
              addLabel="Нэр"
              invalid={p.nameInvalid}
              disabled={p.disabled}
            />
          </span>
        </div>

        {/* ── Бараа ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          {p.cards.map((card, i) => (
            <PreviewProductCard
              key={card.id}
              card={card}
              editable={i === 0}
              badgeLabel={p.badgeLabel}
              tickerTheme={p.tickerTheme}
              disabled={p.disabled}
              onBadgeLabel={p.onBadgeLabel}
            />
          ))}
          {Array.from({ length: placeholders }, (_, i) => (
            <div key={i} aria-hidden className="flex flex-col">
              <div className="bg-secondary aspect-4/5 rounded-2xl" />
              <div className="bg-secondary mt-3 h-3 w-1/2 rounded-xs" />
              <div className="bg-secondary mt-2 h-4 w-3/4 rounded-xs" />
            </div>
          ))}
        </div>
        {p.cards.length === 0 && (
          <p className="text-muted-foreground text-center text-sm">
            <button
              type="button"
              className="text-foreground underline underline-offset-4"
              onClick={p.onPickProducts}
            >
              Бараагаа ②-р алхамд сонгоно уу
            </button>{" "}
            — сонгосон эхний {PREVIEW_CARD_COUNT} бараа энд харагдана.
          </p>
        )}
      </div>
    </div>
  );
}

/** Дэлгүүрийн `ProductCard`-ын төрх — холбоос, сагс, хүслийн товчгүй. */
function PreviewProductCard({
  card,
  editable,
  badgeLabel,
  tickerTheme,
  disabled,
  onBadgeLabel,
}: {
  card: PreviewCard;
  /** Тэмдэг дээд зурвасны өнгөтэй (дэлгүүрийн `SaleChip`). */
  tickerTheme: SaleEventTickerTheme;
  /** Тэмдгийг эхний картан дээр засна — бүх карт зэрэг солигдоно. */
  editable: boolean;
  badgeLabel: string;
  disabled?: boolean;
  onBadgeLabel: (value: string) => void;
}) {
  const badge = previewBadge(badgeLabel, card.discounted);
  // Дэлгүүрийн `SaleBadge`-тэй ижил (`SaleChip`): зурвасны өнгө, ард нь «~10%».
  const pct = eventPctText(card.maxPct);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="bg-secondary relative aspect-4/5 rounded-2xl">
        {card.image && (
          <Image
            src={card.image}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, 220px"
            className="rounded-2xl object-cover"
          />
        )}
        <div className="absolute inset-x-2.5 top-2.5 flex flex-col gap-1">
          {editable ? (
            <div className="flex items-center gap-1.5">
              <PreviewMarker n={4} />
              <SaleChip
                theme={tickerTheme}
                pct={pct}
                className="max-w-full min-w-0"
              >
                <EditableText
                  value={badgeLabel}
                  onChange={onBadgeLabel}
                  label="Барааны картын тэмдэг"
                  maxLength={L.badgeLabel}
                  fallback={
                    card.discounted ? SALE_EVENT_DEFAULT_BADGE : undefined
                  }
                  addLabel="+ Тэмдэг нэмэх"
                  disabled={disabled}
                  className="outline-announce-chip"
                />
              </SaleChip>
            </div>
          ) : (
            badge && (
              <SaleChip theme={tickerTheme} pct={pct} className="max-w-full">
                <span className="wrap-break-word">{badge}</span>
              </SaleChip>
            )
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-0.5">
        <span className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
          {card.brand}
        </span>
        <span className="font-serif text-base/tight font-medium">
          {card.name}
        </span>
        {card.price !== null && card.basePrice !== null && (
          <span className="text-foreground/70 mt-1.5 flex flex-wrap items-baseline gap-1.5 text-sm font-semibold tracking-tight">
            {formatPrice(card.price)}
            {card.basePrice > card.price && (
              <span className="text-muted-foreground text-xs font-normal line-through">
                {formatPrice(card.basePrice)}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
