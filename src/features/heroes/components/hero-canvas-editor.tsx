"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProductOption } from "@/features/admin/lib/product-option";
import type { HeroThemeKey } from "@/lib/ai/hero-prompt";
import { HERO_LIMITS } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  HERO_FIELDS,
  HERO_FIELD_LABEL,
  HERO_FIELD_MAX,
  canvasPreview,
  heroFieldValue,
  viewFields,
  withHeroField,
  type CanvasView,
  type HeroCanvasDraft,
  type HeroField,
} from "../canvas-model";
import type { HeroLinkOption } from "../link-presets";
import type { HeroAiResult } from "./hero-ai-panel";
import { HeroFrame } from "./hero-frame";
import { HeroImageSource } from "./hero-image-source";
import { HeroLinkPicker } from "./hero-link-picker";

const VIEW_WIDTH: Record<CanvasView, number> = { desktop: 1440, mobile: 390 };

/** Сэлгэгчийн нэг товч — сонгогдсон нь `bg-cta` (CLAUDE.md). */
function Segment<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div role="radiogroup" aria-label={label} className="bg-secondary flex rounded-full p-0.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-60",
              value === v
                ? "bg-cta text-cta-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Нүүрний баннерын canvas (studio-ux.md D3, §5.4): жинхэнэ `CampaignHero`
 * том харагдаж, текстийг нь баннер дээр нь засна; товчны «хаашаа очих»,
 * текстийн өнгө, зураг (AI / оруулах). Текстийн input байхгүй.
 * Арга хэмжээний студи (④) ба «Нүүрний баннер» хуудас (S4) хоёулаа.
 */
export function HeroCanvasEditor({
  value,
  onChange,
  linkOptions,
  groupId,
  heroId,
  aiConfigured,
  defaultTheme,
  defaultProducts,
  altPlaceholder,
  disabled = false,
}: {
  value: HeroCanvasDraft;
  onChange: (next: HeroCanvasDraft) => void;
  linkOptions: readonly HeroLinkOption[];
  groupId: string;
  heroId: string | null;
  aiConfigured: boolean;
  defaultTheme: HeroThemeKey;
  defaultProducts: ProductOption[];
  /** Зургийн тайлбар хоосон үед хадгалагдах өгөгдмөл. */
  altPlaceholder?: string;
  disabled?: boolean;
}) {
  const [view, setView] = React.useState<CanvasView>("desktop");
  const [focused, setFocused] = React.useState<HeroField | null>(null);
  /** Сүүлд дарсан товч — сонгогч нь тодорно (focus алдсан ч). */
  const [lastButton, setLastButton] = React.useState<HeroField | null>(null);
  const [titleLines, setTitleLines] = React.useState(0);

  const preview = React.useMemo(
    () => canvasPreview(value, disabled ? "view" : "edit"),
    [value, disabled],
  );
  const edit = React.useMemo(() => {
    if (disabled) return null;
    const values = Object.fromEntries(
      HERO_FIELDS.map((f) => [f, heroFieldValue(value, f)]),
    ) as Record<HeroField, string>;
    return {
      fields: viewFields(view),
      values,
      max: HERO_FIELD_MAX,
      labels: HERO_FIELD_LABEL,
      placeholders: preview.placeholders,
      invalid: preview.invalid,
    };
  }, [disabled, value, view, preview]);

  const sample = view === "desktop" ? preview.sample.desktop : preview.sample.mobile;

  function onImages(r: HeroAiResult) {
    let next = value;
    if (r.desktop) {
      next = { ...next, desktopImage: r.desktop };
      // Компьютерын зургийн зүүн тал (текстийн бүс) л өнгийг шийднэ.
      if (r.suggestDark !== next.dark) {
        next = { ...next, dark: r.suggestDark };
        toast.success(
          r.suggestDark
            ? "Зургийн зүүн тал бараан тул текстийг цагаан болголоо."
            : "Зургийн зүүн тал цайвар тул текстийг бараан болголоо.",
        );
      }
    }
    if (r.mobile) next = { ...next, mobileImage: r.mobile };
    onChange(next);
  }

  const focusedValue = focused ? heroFieldValue(value, focused) : "";
  const focusedMax = focused ? HERO_FIELD_MAX[focused] : 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segment
            label="Харагдац"
            value={view}
            options={[
              ["desktop", "Компьютер"],
              ["mobile", "Утас"],
            ]}
            onChange={(v) => {
              setView(v);
              setFocused(null);
            }}
          />
          <Segment
            label="Текстийн өнгө"
            value={value.dark ? "light" : "dark"}
            disabled={disabled || preview.sample.desktop}
            options={[
              ["dark", "Бараан"],
              ["light", "Цагаан"],
            ]}
            onChange={(v) => onChange({ ...value, dark: v === "light" })}
          />
        </div>

        <div className="bg-secondary relative rounded-lg p-2 sm:p-3">
          <div className={cn(view === "mobile" && "mx-auto max-w-97.5")}>
            <HeroFrame
              key={view}
              width={VIEW_WIDTH[view]}
              title={view === "desktop" ? "Баннер — компьютер" : "Баннер — утас"}
              campaign={preview.campaign}
              edit={edit}
              onEdit={(f, v) => onChange(withHeroField(value, f, v))}
              onFocusField={(f) => {
                setFocused(f);
                if (f) setLastButton(f === "primary" || f === "secondary" ? f : null);
              }}
              onTitleLines={view === "desktop" ? setTitleLines : undefined}
            />
          </div>
          {sample && (
            <span className="bg-background/90 text-foreground absolute top-4 right-4 rounded-full px-2.5 py-1 text-xs font-medium sm:top-5 sm:right-5">
              Жишээ зураг
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
          <p className="text-muted-foreground min-w-0 flex-1 text-pretty">
            {disabled
              ? "Энэ арга хэмжээ дууссан тул баннер засагдахгүй."
              : sample
                ? "Текст дээр дарж засна. Зураг бэлэн болтол жишээ зураг дээр текстээ засаарай."
                : view === "desktop"
                  ? "Текст дээр дарж засна. Утсан дээрх харагдцыг «Утас» дээр дарж шалгаарай."
                  : "Текст дээр дарж засна. Утсан дээр тайлбарыг тусад нь, богинохон бичнэ."}
          </p>
          {focused && (
            <p
              className={cn(
                "shrink-0 tabular-nums",
                focusedValue.length >= focusedMax
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {HERO_FIELD_LABEL[focused]} · {focusedValue.length}/{focusedMax}
            </p>
          )}
        </div>
        {view === "desktop" && titleLines > 2 && (
          <p className="text-warning flex items-center gap-1.5 text-sm" role="status">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            Гарчиг {titleLines} мөр болж байна — богиносговол цэвэрхэн.
          </p>
        )}
        {preview.invalid.length > 0 && (
          <p className="text-destructive text-sm" role="status">
            {preview.invalid.map((f) => HERO_FIELD_LABEL[f]).join(", ")} хоосон
            байна — баннер дээр нь дарж бичнэ үү.
          </p>
        )}
        {view === "mobile" && value.secondaryLabel.trim() && (
          <p className="text-muted-foreground text-sm">
            Нэмэлт товч зөвхөн компьютер дээр гарна.
          </p>
        )}
        {view === "mobile" && value.desktopImage && !value.mobileImage && (
          <p className="text-warning text-sm text-pretty" role="status">
            Утасны зураг хэрэгтэй — доорх «Зураг»-аас AI-аар (компьютерын
            зураг дээрх «Mobile хувилбар үүсгэх») эсвэл өөрөө оруулна уу.
          </p>
        )}
      </section>

      <section className="space-y-2" aria-label="Товчны холбоос">
        <HeroLinkPicker
          label={`Гол товч «${value.primaryLabel.trim() || "…"}» — дарахад хаашаа очих вэ?`}
          value={value.primaryTarget}
          options={linkOptions}
          disabled={disabled}
          highlighted={lastButton === "primary"}
          onChange={(t) => onChange({ ...value, primaryTarget: t })}
        />
        {value.secondaryLabel.trim() && value.secondaryTarget && (
          <HeroLinkPicker
            label={`Нэмэлт товч «${value.secondaryLabel.trim()}» — дарахад хаашаа очих вэ?`}
            value={value.secondaryTarget}
            options={linkOptions}
            disabled={disabled}
            highlighted={lastButton === "secondary"}
            onChange={(t) => onChange({ ...value, secondaryTarget: t })}
            onRemove={() => onChange(withHeroField(value, "secondary", ""))}
          />
        )}
      </section>

      {!disabled && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Зураг</h3>
          <HeroImageSource
            groupId={groupId}
            heroId={heroId}
            aiConfigured={aiConfigured}
            desktopImage={value.desktopImage}
            mobileImage={value.mobileImage}
            defaultTheme={defaultTheme}
            defaultProducts={defaultProducts}
            onImages={onImages}
          />
          <details className="group text-sm">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
              Нэмэлт
            </summary>
            <label className="mt-3 block space-y-1.5">
              <span className="font-medium">Зургийн тайлбар</span>
              <Input
                value={value.imageAlt}
                maxLength={HERO_LIMITS.imageAlt}
                placeholder={altPlaceholder}
                onChange={(e) => onChange({ ...value, imageAlt: e.target.value })}
              />
              <span className="text-muted-foreground block text-xs">
                Хараагүй хэрэглэгч, Google-д. Жишээ: «Layton, Aventus болон decant
                савнууд».
              </span>
            </label>
          </details>
        </section>
      )}
    </div>
  );
}
