"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/features/admin/components/editable-text";
import {
  GENDER_LABEL,
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_LIMITS as L,
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  SALE_EVENT_BANNER_DESCRIPTION,
  SaleEventBannerView,
  SaleEventCountdownLine,
} from "../sale-event-banner-view";
import {
  PREVIEW_CARD_COUNT,
  previewBadge,
  type PreviewCard,
} from "./catalog-preview-model";

/** Дэлгүүрийн шүүлтүүрийн `Chip`-ийн класс (catalog-filters.tsx). */
const CHIP = "rounded-sm px-3 py-2 text-center text-sm font-medium";

/** Засагдах цэгийн дугаар — доорх тайлбарын жагсаалттай таарна. */
export function PreviewMarker({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="bg-cta text-cta-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-full font-sans text-[11px] leading-none font-semibold tracking-normal tabular-nums"
    >
      {n}
    </span>
  );
}

export interface CatalogPreviewProps {
  name: string;
  headline: string;
  description: string;
  badgeLabel: string;
  showCountdown: boolean;
  /** «7 өдөр 4 цаг» — огноогүй бол null. */
  countdownText: string | null;
  cards: PreviewCard[];
  nameInvalid?: boolean;
  disabled?: boolean;
  onName: (value: string) => void;
  onHeadline: (value: string) => void;
  onDescription: (value: string) => void;
  onBadgeLabel: (value: string) => void;
  onShowCountdown: (value: boolean) => void;
  /** Бараа сонгоогүй үед ②-р алхам руу. */
  onPickProducts: () => void;
}

/**
 * Каталогийн хуудасны жижигрүүлсэн, жинхэнэ төрхтэй хэсэг (studio-ux.md D4,
 * §5.3): шүүлтүүрийн chip, арга хэмжээний зурвас, эхний 4 бараа. Зөвхөн
 * харуулах компонент — live өгөгдөл ачаалахгүй; дэлгүүрийн `Chip`,
 * `SaleEventBannerView`, `ProductCard`-ын класс, token-ыг дагана. Текст бүр
 * байгаа газраа засагдана (`EditableText`).
 */
export function CatalogPreview(p: CatalogPreviewProps) {
  const placeholders = Math.max(0, PREVIEW_CARD_COUNT - p.cards.length);
  return (
    <div className="bg-background field-edge space-y-5 rounded-xl p-4 sm:p-6">
      {/* ── Шүүлтүүр ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(CHIP, "bg-foreground text-background")}>Бүгд</span>
        <span className={cn(CHIP, "bg-secondary")}>{GENDER_LABEL.male}</span>
        <span className={cn(CHIP, "bg-secondary")}>{GENDER_LABEL.female}</span>
        <span
          className={cn(CHIP, "bg-secondary flex min-w-0 items-center gap-2")}
        >
          <PreviewMarker n={1} />
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

      {/* ── Зурвас ───────────────────────────────────────────────── */}
      <SaleEventBannerView
        title={
          <span className="flex items-start gap-2">
            <span className="flex h-lh items-center">
              <PreviewMarker n={2} />
            </span>
            <EditableText
              value={p.headline}
              onChange={p.onHeadline}
              label="Гарчиг"
              maxLength={L.headline}
              fallback={p.name.trim() || "Арга хэмжээний нэр"}
              disabled={p.disabled}
            />
          </span>
        }
        action={
          <Button
            variant="ghost"
            size="sm"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none shrink-0 self-start"
          >
            <X />
            Бүх каталог
          </Button>
        }
      >
        <div className={cn(SALE_EVENT_BANNER_DESCRIPTION, "flex items-start gap-2")}>
          <span className="flex h-lh items-center">
            <PreviewMarker n={3} />
          </span>
          <EditableText
            block
            className="min-w-0 flex-1"
            value={p.description}
            onChange={p.onDescription}
            label="Тайлбар"
            maxLength={L.description}
            addLabel="+ Тайлбар нэмэх"
            disabled={p.disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <PreviewMarker n={4} />
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
            className="outline-cta rounded-xs outline-offset-2 hover:outline-1 focus-visible:outline-2 disabled:pointer-events-none"
          >
            <SaleEventCountdownLine
              as="span"
              text={p.countdownText ?? "7 өдөр"}
              className={cn(!p.showCountdown && "line-through opacity-50")}
            />
          </button>
          {!p.showCountdown && (
            <span className="text-muted-foreground text-xs">
              Унтраалттай — харагдахгүй
            </span>
          )}
        </div>
      </SaleEventBannerView>

      {/* ── Бараа ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {p.cards.map((card, i) => (
          <PreviewProductCard
            key={card.id}
            card={card}
            editable={i === 0}
            badgeLabel={p.badgeLabel}
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
  );
}

/** Дэлгүүрийн `ProductCard`-ын төрх — холбоос, сагс, хүслийн товчгүй. */
function PreviewProductCard({
  card,
  editable,
  badgeLabel,
  disabled,
  onBadgeLabel,
}: {
  card: PreviewCard;
  /** Тэмдгийг эхний картан дээр засна — бүх карт зэрэг солигдоно. */
  editable: boolean;
  badgeLabel: string;
  disabled?: boolean;
  onBadgeLabel: (value: string) => void;
}) {
  const badge = previewBadge(badgeLabel, card.discounted);
  const badgeClass = "bg-background/85! w-fit max-w-full backdrop-blur-sm";
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
        <div className="absolute top-2.5 inset-x-2.5 flex flex-col gap-1">
          {editable ? (
            <div className="flex items-center gap-1.5">
              <PreviewMarker n={5} />
              <Badge variant="sale" className={cn(badgeClass, "min-w-0")}>
                <EditableText
                  value={badgeLabel}
                  onChange={onBadgeLabel}
                  label="Барааны картын тэмдэг"
                  maxLength={L.badgeLabel}
                  fallback={card.discounted ? SALE_EVENT_DEFAULT_BADGE : undefined}
                  addLabel="+ Тэмдэг нэмэх"
                  disabled={disabled}
                />
              </Badge>
            </div>
          ) : (
            badge && (
              <Badge variant="sale" className={badgeClass}>
                <span className="wrap-break-word">{badge}</span>
              </Badge>
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
