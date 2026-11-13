"use client";

import * as React from "react";
import { Check, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { useProductOptions } from "@/features/admin/hooks/use-product-options";
import { HERO_AI_LIMITS } from "@/lib/constants";
import {
  HERO_AI_MAX_PRODUCTS,
  HERO_THEMES,
  HERO_THEME_KEYS,
  type HeroThemeKey,
} from "@/lib/ai/hero-prompt";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { HeroGenerationJob } from "@/app/api/admin/heroes/generations/route";
import type { HeroDesktopImage, HeroMobileImage } from "../types";

export interface HeroAiResult {
  desktop?: HeroDesktopImage;
  mobile?: HeroMobileImage;
  suggestDark: boolean;
}

/** Текстийн бүс (prompts/hero.md §1) — үр дүнгийн дээр тасархай шугам. */
const SAFE_ZONE = { desktop: 55, mobile: 58 } as const;

/**
 * AI hero зураг (plan §8.1): ① сэдэв + нэмэлт тайлбар → ② «Desktop үүсгэх»
 * (≈1–2 мин, дахин дарж 2–4 хувилбар) → ③ safe-zone давхаргатай харж →
 * ④ сонгосон desktop-ыг mobile-ийн лавлах болгоно → ⑤ «Ашиглах».
 * Хадгалаагүй hero-д ч ажиллана (`groupId`).
 */
export function HeroAiPanel({
  groupId,
  heroId,
  configured,
  onUse,
}: {
  groupId: string;
  heroId: string | null;
  /** `OPENAI_API_KEY` тохируулсан эсэх (сервер). */
  configured: boolean;
  onUse: (r: HeroAiResult) => void;
}) {
  const [theme, setTheme] = React.useState<HeroThemeKey>("winter");
  const [extra, setExtra] = React.useState("");
  const [fast, setFast] = React.useState(false);
  const [desktopRef, setDesktopRef] = React.useState<string | null>(null);
  // Hero-д оруулах үнэртэн (DB) — дараалал = зүүн / төв / баруун байрлал.
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const products = useProductOptions([]);
  const [jobs, setJobs] = React.useState<HeroGenerationJob[]>([]);
  const [starting, setStarting] = React.useState<"desktop" | "mobile" | null>(
    null,
  );
  const [using, setUsing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await adminFetch<{ jobs: HeroGenerationJob[] }>(
      `/api/admin/heroes/generations?groupId=${groupId}`,
    );
    if (res.ok) setJobs(res.data.jobs);
  }, [groupId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const busy = jobs.some(
    (j) => j.status === "pending" || j.status === "generating",
  );
  // Ажил явж байх үед 4с тутам (барааны зургийн урсгалтай ижил).
  React.useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [busy, load]);

  async function start(target: "desktop" | "mobile") {
    setStarting(target);
    try {
      const res = await adminFetch("/api/admin/heroes/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          heroId,
          target,
          theme,
          extra,
          quality: fast ? "fast" : "high",
          desktopRefUrl: target === "mobile" ? desktopRef : null,
          productIds,
        }),
      });
      if (!res.ok) {
        toast.error(res.error, "Үүсгэж чадсангүй");
        return;
      }
      toast.success(
        "Дараалалд орлоо — 1–2 минут болно. Энэ хооронд бусад талбараа бөглөж болно.",
      );
      await load();
    } finally {
      setStarting(null);
    }
  }

  async function use(job: HeroGenerationJob) {
    setUsing(job.id);
    try {
      const res = await adminFetch<HeroAiResult>(
        `/api/admin/heroes/generations/${job.id}/use`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error(res.error, "Ашиглаж чадсангүй");
        return;
      }
      onUse(res.data);
      toast.success(
        job.target === "desktop"
          ? "Desktop зураг солигдлоо. Hero-гоо хадгалахад нүүрэнд гарна."
          : "Утасны зураг солигдлоо. Hero-гоо хадгалахад нүүрэнд гарна.",
      );
    } finally {
      setUsing(null);
    }
  }

  if (!configured) {
    return (
      <p className="text-muted-foreground bg-secondary/40 rounded-md p-3 text-sm">
        AI зураг үүсгэхэд <code>OPENAI_API_KEY</code> тохируулаагүй байна. Одоохондоо
        дизайнерын зургийг «Зураг оруулах»-аар оруулна уу.
      </p>
    );
  }

  return (
    <div className="bg-secondary/40 space-y-4 rounded-lg p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4" aria-hidden />
        AI-аар үүсгэх
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Сэдэв">
        {HERO_THEME_KEYS.map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            role="radio"
            aria-checked={theme === k}
            variant={theme === k ? "default" : "outline"}
            onClick={() => setTheme(k)}
          >
            {HERO_THEMES[k].label}
          </Button>
        ))}
      </div>
      <ProductRefs
        ids={productIds}
        onChange={setProductIds}
        picker={products}
      />
      <Field
        label={theme === "custom" ? "Сэдвийн тайлбар" : "Нэмэлт тайлбар (заавал биш)"}
        hint={`${extra.length}/${HERO_AI_LIMITS.extraMax}. Англиар бичвэл илүү тогтвортой.`}
      >
        <textarea
          rows={2}
          maxLength={HERO_AI_LIMITS.extraMax}
          value={extra}
          placeholder="жишээ: more gold accents, softer light"
          onChange={(e) => setExtra(e.target.value)}
          className="bg-background field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
        />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={fast}
          onChange={(e) => setFast(e.target.checked)}
        />
        Хурдан хэмжээ (2688×960 / 1536×1152) — өндөр нарийвчлал хугацаа хэтэрвэл
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          size="sm"
          loading={starting === "desktop"}
          disabled={starting !== null || (theme === "custom" && !extra.trim())}
          onClick={() => start("desktop")}
        >
          Desktop үүсгэх
        </LoadingButton>
        <LoadingButton
          type="button"
          size="sm"
          variant="outline"
          loading={starting === "mobile"}
          disabled={starting !== null || (theme === "custom" && !extra.trim())}
          onClick={() => start("mobile")}
        >
          Mobile үүсгэх
        </LoadingButton>
        <span className="text-muted-foreground text-xs">
          {desktopRef
            ? "Mobile нь сонгосон desktop-ын уур амьсгалыг дагана."
            : "Mobile-ийн өмнө desktop хувилбараас «Mobile-д лавлах» сонгоорой."}
        </span>
      </div>

      {jobs.length > 0 && (
        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {jobs.map((j) => (
            <li key={j.id} className="bg-card space-y-2 rounded-md p-2">
              <div
                className={cn(
                  "bg-muted relative overflow-hidden rounded",
                  j.target === "desktop" ? "aspect-14/5" : "aspect-4/3",
                )}
              >
                {j.status === "done" && j.result_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- PNG мастер, админы preview */}
                    <img
                      src={j.result_url}
                      alt=""
                      className="size-full object-cover"
                    />
                    {/* Текстийн бүс: энэ шугамын зүүн талд юу ч байх ёсгүй. */}
                    <div
                      aria-hidden
                      className="border-background/90 bg-background/10 absolute inset-y-0 left-0 border-r-2 border-dashed"
                      style={{ width: `${SAFE_ZONE[j.target]}%` }}
                    />
                  </>
                ) : (
                  <div className="text-muted-foreground flex size-full items-center justify-center p-2 text-center text-xs">
                    {j.status === "failed"
                      ? (j.error ?? "Амжилтгүй")
                      : j.status === "generating"
                        ? "Үүсгэж байна… (1–2 мин)"
                        : "Дараалалд…"}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  {j.target === "desktop" ? "Desktop" : "Утас"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {HERO_THEMES[j.theme_key as HeroThemeKey]?.label ?? j.theme_key}
                  {j.product_ids?.length
                    ? ` · ${j.product_ids
                        .map((id) => products.byId(id)?.name ?? "үнэртэн")
                        .join(", ")}`
                    : ""}
                </span>
                {j.status === "done" && (
                  <div className="ml-auto flex flex-wrap gap-1">
                    {j.target === "desktop" && (
                      <Button
                        type="button"
                        size="sm"
                        variant={desktopRef === j.result_url ? "default" : "ghost"}
                        onClick={() => {
                          const on = desktopRef !== j.result_url;
                          setDesktopRef(on ? j.result_url : null);
                          // Mobile нь тэр desktop-ын үнэртнүүдээр — хоёр
                          // зураг ижил бараатай байх ёстой.
                          if (on) setProductIds(j.product_ids ?? []);
                        }}
                      >
                        {desktopRef === j.result_url && <Check className="size-4" />}
                        Mobile-д лавлах
                      </Button>
                    )}
                    <LoadingButton
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={using === j.id}
                      disabled={using !== null}
                      onClick={() => use(j)}
                    >
                      Ашиглах
                    </LoadingButton>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const POSITION = ["Зүүн", "Төв", "Баруун"] as const;

/**
 * Hero-д оруулах үнэртэн (ихдээ 3, plan §17 «Hero-д бараа сонгож AI-аар тэр
 * бараатай зураг»). Хоосон бол одоогийн hero-гийн бараагаар restyle.
 * Тэдний зураг (AI лавлах эсвэл барааны эхний зураг) reference-ийн эхэнд орно.
 */
function ProductRefs({
  ids,
  onChange,
  picker,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  picker: ReturnType<typeof useProductOptions>;
}) {
  const { q, setQ, items, loading, byId } = picker;
  const full = ids.length >= HERO_AI_MAX_PRODUCTS;
  const label = (id: string) => {
    const p = byId(id);
    return p ? `${p.brand} ${p.name}` : "Сонгосон үнэртэн";
  };
  return (
    <Field
      label={`Hero-д оруулах үнэртэн (ихдээ ${HERO_AI_MAX_PRODUCTS})`}
      hint={
        ids.length
          ? "Сонгосон дарааллаар зүүнээс баруун тийш байрлана. Шошго тод гарахын тулд бараанд «AI лавлах зураг» байвал сайн."
          : "Сонгохгүй бол одоогийн hero-гийн савнууд хэвээр, зөвхөн уур амьсгал солигдоно."
      }
    >
      <div className="space-y-2">
        {ids.length > 0 && (
          <ul role="list" className="flex flex-wrap gap-2">
            {ids.map((id, i) => (
              <li
                key={id}
                className="bg-card flex items-center gap-2 rounded-md py-1 pr-1 pl-2 text-sm"
              >
                <span className="text-muted-foreground text-xs">
                  {ids.length === 1 ? "Төв" : ids.length === 2 ? (i === 0 ? "Зүүн" : "Баруун") : POSITION[i]}
                </span>
                <span className="max-w-48 truncate">{label(id)}</span>
                <button
                  type="button"
                  aria-label={`${label(id)}-г хасах`}
                  className="text-muted-foreground hover:text-foreground grid size-8 place-items-center"
                  onClick={() => onChange(ids.filter((x) => x !== id))}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!full && (
          <div className="space-y-1">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Нэр, брэндээр хайх…"
                aria-label="Hero-д оруулах үнэртэн хайх"
                className="bg-background pl-9"
              />
            </div>
            {q.trim() && (
              <ul
                className={cn(
                  "bg-card max-h-48 overflow-y-auto rounded-md",
                  loading && "opacity-60",
                )}
                aria-busy={loading}
              >
                {items.filter((p) => !ids.includes(p.id)).length === 0 ? (
                  <li className="text-muted-foreground p-3 text-sm">
                    {loading ? "Хайж байна…" : "Илэрц алга."}
                  </li>
                ) : (
                  items
                    .filter((p) => !ids.includes(p.id))
                    .map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="hover:bg-accent flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm md:min-h-9"
                          onClick={() => {
                            onChange([...ids, p.id]);
                            setQ("");
                          }}
                        >
                          <span className="text-muted-foreground text-xs uppercase">
                            {p.brand}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        </button>
                      </li>
                    ))
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
