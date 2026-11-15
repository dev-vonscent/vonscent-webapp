"use client";

import * as React from "react";
import { Check, Loader2, Maximize2, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/shared/info-tip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxScroll,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { PickerPopup } from "@/features/admin/components/customer-picker";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { useProductOptions } from "@/features/admin/hooks/use-product-options";
import type { ProductOption } from "@/features/admin/lib/product-option";
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
  defaultTheme = "winter",
  defaultProducts = [],
  inUse = { desktop: null, mobile: null },
}: {
  groupId: string;
  heroId: string | null;
  /** `OPENAI_API_KEY` тохируулсан эсэх (сервер). */
  configured: boolean;
  onUse: (r: HeroAiResult) => void;
  /** Урьдчилж сонгох сэдэв (студи: арга хэмжээний нэрээс). */
  defaultTheme?: HeroThemeKey;
  /** Урьдчилж бөглөх үнэртэн (студи: ②-т сонгосон эхний 3). */
  defaultProducts?: ProductOption[];
  /** Баннерт одоо байгаа зургийн AI ажлын id (`generationIdOf`). */
  inUse?: { desktop: string | null; mobile: string | null };
}) {
  const isUsed = (j: HeroGenerationJob) => j.id === inUse[j.target];
  const [theme, setTheme] = React.useState<HeroThemeKey>(defaultTheme);
  const [extra, setExtra] = React.useState("");
  const [fast, setFast] = React.useState(false);
  // Hero-д оруулах үнэртэн (DB) — тогтмол гурван байрлал: зүүн / төв / баруун.
  const [slots, setSlots] = React.useState<Slots>(() =>
    toSlots(defaultProducts.slice(0, HERO_AI_MAX_PRODUCTS)),
  );
  const products = useProductOptions(defaultProducts);
  // Сервер, prompt нь дарааллаар байрлуулна (зэрэгцэн зогсох бүлэг) — хоосон
  // байрлалыг алгасаад зүүнээс баруун тийш илгээнэ.
  const productIds = slots.flatMap((p) => (p ? [p.id] : []));
  const [jobs, setJobs] = React.useState<HeroGenerationJob[]>([]);
  // "desktop" эсвэл `mobile:<desktop ажлын id>` — аль товч ачаалж байгаа.
  const [starting, setStarting] = React.useState<string | null>(null);
  const [using, setUsing] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<HeroGenerationJob | null>(null);

  // Ажлуудын үнэртний нэр (сервер өгнө) — хайлтын кэшэд байхгүй ч нэрлэнэ.
  const [named, setNamed] = React.useState<Map<string, ProductOption>>(
    () => new Map(),
  );
  const nameOf = (id: string) => named.get(id) ?? products.byId(id);
  // Хэрэглэгч маягтад хүрээгүй бол эхний ачаалалтаар сүүлийн ажлын сэдэв,
  // үнэртнийг сэргээнэ: генерац 1–2 мин явах хооронд өөр алхам руу явж
  // ирэхэд (панел дахин mount) сонголт өгөгдмөл рүүгээ буцахгүй. Нэмэлт
  // тайлбар санаатайгаар хоосон эхэлнэ.
  const touched = React.useRef(false);
  const seeded = React.useRef(false);
  const pickSlots = (next: Slots) => {
    touched.current = true;
    setSlots(next);
  };
  const pickTheme = (next: HeroThemeKey) => {
    touched.current = true;
    setTheme(next);
  };

  const load = React.useCallback(async () => {
    const res = await adminFetch<{
      jobs: HeroGenerationJob[];
      products?: ProductOption[];
    }>(`/api/admin/heroes/generations?groupId=${groupId}`);
    if (!res.ok) return;
    const { jobs: list, products: names = [] } = res.data;
    setJobs(list);
    const map = new Map(names.map((p) => [p.id, p]));
    setNamed(map);
    if (seeded.current) return;
    seeded.current = true;
    const last = list[0];
    if (!last || touched.current) return;
    if (HERO_THEME_KEYS.includes(last.theme_key as HeroThemeKey)) {
      setTheme(last.theme_key as HeroThemeKey);
    }
    const picked = (last.product_ids ?? []).flatMap((id) => {
      const p = map.get(id);
      return p ? [p] : [];
    });
    if (picked.length > 0) setSlots(toSlots(picked));
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

  /** Формын сэдэв, үнэртнээр desktop зураг. */
  function startDesktop() {
    return generate("desktop", {
      target: "desktop",
      theme,
      extra,
      productIds,
      desktopRefUrl: null,
    });
  }

  /**
   * Үүссэн desktop-оос mobile хувилбар: тэр зургийг лавлаж, тэр л сэдэв,
   * тайлбар, үнэртнээр — хоёр зураг нэг зураг авалт шиг тохирно (маягтын
   * одоогийн утгаас үл хамаарна; «Өөрөө бичих» сэдэвт тайлбар нь заавал).
   */
  function startMobile(desktop: HeroGenerationJob) {
    return generate(`mobile:${desktop.id}`, {
      target: "mobile",
      theme: desktop.theme_key as HeroThemeKey,
      extra: desktop.theme_extra ?? "",
      productIds: desktop.product_ids ?? [],
      desktopRefUrl: desktop.result_url,
    });
  }

  async function generate(
    key: string,
    input: {
      target: "desktop" | "mobile";
      theme: HeroThemeKey;
      extra: string;
      productIds: string[];
      desktopRefUrl: string | null;
    },
  ) {
    setStarting(key);
    try {
      const res = await adminFetch("/api/admin/heroes/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          heroId,
          quality: fast ? "fast" : "high",
          ...input,
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

  /** Амжилтгүй / хэрэггүй хувилбарыг түүхээс устгана (PNG мастер хамт). */
  async function remove(job: HeroGenerationJob) {
    setRemoving(job.id);
    try {
      const res = await adminFetch(`/api/admin/heroes/generations/${job.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(res.error, "Устгаж чадсангүй");
        return;
      }
      if (preview?.id === job.id) setPreview(null);
      setJobs((list) => list.filter((j) => j.id !== job.id));
    } finally {
      setRemoving(null);
    }
  }

  if (!configured) {
    return (
      <p className="text-muted-foreground bg-secondary/40 rounded-md p-3 text-sm">
        AI зураг үүсгэхэд <code>OPENAI_API_KEY</code> тохируулаагүй байна.
        Одоохондоо дизайнерын зургийг «Зураг оруулах»-аар оруулна уу.
      </p>
    );
  }

  return (
    <div className="bg-card space-y-5 rounded-lg p-4">
      <fieldset className="space-y-2">
        <legend className="flex items-center gap-1.5 text-sm leading-none font-medium">
          Сэдэв
          <InfoTip label="Сэдэв гэж юу вэ">
            Сэдэв бүрт бэлэн prompt бий: уур амьсгал, гэрэл, чимэглэл,
            оруулахгүй зүйлс. Сонгоод үнэртнээ тавихад хангалттай. «Өөрөө бичих»
            сонговол сэдвээ доорх талбарт өөрөө тайлбарлана.
          </InfoTip>
        </legend>
        <div
          className="flex flex-wrap gap-1.5 pt-1"
          role="radiogroup"
          aria-label="Сэдэв"
        >
          {HERO_THEME_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={theme === k}
              onClick={() => pickTheme(k)}
              className={cn(
                "h-8 rounded-full px-3 text-[13px] font-medium",
                theme === k
                  ? "bg-cta text-cta-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {HERO_THEMES[k].label}
            </button>
          ))}
        </div>
      </fieldset>
      <ProductSlots slots={slots} onChange={pickSlots} picker={products} />
      <Field
        label={
          theme === "custom" ? "Сэдвийн тайлбар" : "Нэмэлт тайлбар (заавал биш)"
        }
        hint={`${extra.length}/${HERO_AI_LIMITS.extraMax} · Англиар бичвэл тогтвортой.`}
      >
        <textarea
          rows={2}
          maxLength={HERO_AI_LIMITS.extraMax}
          value={extra}
          placeholder="жишээ: more gold accents, softer light"
          onChange={(e) => setExtra(e.target.value)}
          className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={fast}
              onCheckedChange={(v) => setFast(v === true)}
            />
            Хурдан горим
          </label>
          <InfoTip label="Хурдан горим гэж юу вэ">
            Бага нарийвчлал (2688×960 / 1536×1152). Ердийн горим удаад амжилтгүй
            болбол ашиглана.
          </InfoTip>
        </span>
        <LoadingButton
          type="button"
          className="bg-cta text-cta-foreground hover:bg-cta/90"
          loading={starting === "desktop"}
          disabled={starting !== null || (theme === "custom" && !extra.trim())}
          onClick={() => void startDesktop()}
        >
          <Sparkles />
          Компьютерын зураг үүсгэх
        </LoadingButton>
      </div>

      {jobs.length > 0 && (
        <ul role="list" className="flex flex-wrap items-start gap-3">
          {jobs.map((j) => (
            <li
              key={j.id}
              className={cn(
                "w-full space-y-2 rounded-md p-2 sm:w-auto",
                isUsed(j) ? "bg-cta/10" : "bg-secondary/50",
              )}
            >
              <div
                className={cn(
                  "bg-muted relative overflow-hidden rounded",
                  // Ижил өндөр (h-40), өргөн нь харьцаанаасаа: 2.8:1 ба 4:3.
                  "w-full sm:h-40 sm:w-auto",
                  j.target === "desktop" ? "aspect-14/5" : "aspect-4/3",
                )}
              >
                {j.status === "done" && j.result_url ? (
                  <button
                    type="button"
                    className="group/preview block size-full cursor-zoom-in"
                    aria-label="Томоор харах"
                    onClick={() => setPreview(j)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- PNG мастер, админы preview */}
                    <img
                      src={j.result_url}
                      alt=""
                      className="size-full object-cover"
                    />
                    <span className="bg-background/80 absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full opacity-80 group-hover/preview:opacity-100">
                      <Maximize2 className="size-4" aria-hidden />
                    </span>
                    {/* Текстийн бүс: энэ шугамын зүүн талд юу ч байх ёсгүй. */}
                    <SafeZoneLine target={j.target} />
                    {isUsed(j) && (
                      <InUseMark className="absolute top-1.5 left-1.5" />
                    )}
                  </button>
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
              {/* `w-0 min-w-full`: мөр нь картын өргөнийг тэлэхгүй. */}
              <div className="flex w-0 min-w-full flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  {j.target === "desktop" ? "Компьютер" : "Утас"}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {HERO_THEMES[j.theme_key as HeroThemeKey]?.label ??
                    j.theme_key}
                  {j.product_ids?.length
                    ? ` · ${j.product_ids
                        .map((id) => nameOf(id)?.name ?? "үнэртэн")
                        .join(", ")}`
                    : ""}
                </span>
                {(j.status === "failed" || j.status === "done") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive ml-auto size-8"
                    aria-label="Энэ хувилбарыг устгах"
                    disabled={removing === j.id}
                    onClick={() => remove(j)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                {j.status === "done" && (
                  <div className="flex flex-wrap gap-1">
                    {j.target === "desktop" && j.result_url && (
                      <LoadingButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        loading={starting === `mobile:${j.id}`}
                        disabled={starting !== null}
                        onClick={() => void startMobile(j)}
                      >
                        Утасны хувилбар үүсгэх
                      </LoadingButton>
                    )}
                    {isUsed(j) ? (
                      <span className="text-muted-foreground inline-flex h-9 items-center gap-1.5 px-3 text-sm">
                        <Check className="size-4" aria-hidden />
                        Ашиглаж байна
                      </span>
                    ) : (
                      <LoadingButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={using === j.id}
                        disabled={using !== null}
                        onClick={() => use(j)}
                      >
                        Ашиглах
                      </LoadingButton>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <PreviewDialog
        job={preview}
        used={preview ? isUsed(preview) : false}
        onClose={() => setPreview(null)}
        onUse={(j) => {
          setPreview(null);
          void use(j);
        }}
      />
    </div>
  );
}

/**
 * Үүсгэсэн зургийг томоор (plan §8.1 ③): шошго, жижиг бичгийг нүдээр
 * шалгах. Текстийн бүсийн шугамыг асааж/унтрааж болно.
 */
/** «Баннерт байгаа» — ашиглагдаж буй зургийн тэмдэг. */
function InUseMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-cta text-cta-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      <Check className="size-3.5" aria-hidden />
      Баннерт байгаа
    </span>
  );
}

function PreviewDialog({
  job,
  used,
  onClose,
  onUse,
}: {
  job: HeroGenerationJob | null;
  used: boolean;
  onClose: () => void;
  onUse: (j: HeroGenerationJob) => void;
}) {
  const [zone, setZone] = React.useState(true);
  return (
    <Dialog open={job !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-[min(96vw,1600px)] gap-3 overflow-y-auto p-3 sm:p-4">
        {job?.result_url && (
          <>
            <DialogTitle className="pr-10 text-base">
              {job.target === "desktop" ? "Desktop (2.8:1)" : "Утас (4:3)"} ·{" "}
              {HERO_THEMES[job.theme_key as HeroThemeKey]?.label ??
                job.theme_key}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Үүсгэсэн hero зургийг бүтэн хэмжээгээр харах
            </DialogDescription>
            {/* Бүтэн зураг дэлгэцэнд багтана (өндрөөр хязгаарлана) — 4:3 утасны
                зураг өргөн цонхонд тайрагдаж / гүйлгэгдэж харагдахгүй. Шугам нь
                зургийн өргөнийг дагана (`w-fit`). */}
            <div className="bg-muted relative mx-auto w-fit max-w-full overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- PNG мастер, админы preview */}
              <img
                src={job.result_url}
                alt=""
                className="block size-auto max-h-[calc(100svh-9rem)] max-w-full"
              />
              {zone && <SafeZoneLine target={job.target} labelled />}
              {used && <InUseMark className="absolute top-2 left-2" />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={zone}
                  onChange={(e) => setZone(e.target.checked)}
                />
                Текстийн бүс ({SAFE_ZONE[job.target]}%) харуулах
              </label>
              <a
                href={job.result_url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground ml-auto text-sm underline-offset-4 hover:underline"
              >
                Эх хэмжээгээр нээх
              </a>
              {used ? (
                <span className="text-muted-foreground inline-flex h-9 items-center gap-1.5 px-3 text-sm">
                  <Check className="size-4" aria-hidden />
                  Ашиглаж байна
                </span>
              ) : (
                <Button type="button" size="sm" onClick={() => onUse(job)}>
                  Ашиглах
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const POSITION = ["Зүүн", "Төв", "Баруун"] as const;

/** Зүүн / төв / баруун — хоосон байрлал `null`. */
type Slots = [ProductOption | null, ProductOption | null, ProductOption | null];

/**
 * Дараалсан жагсаалт → байрлал. Prompt-ийн дүрэмтэй ижил (hero-prompt.ts
 * `ORDER`): 1 сав → төв, 2 → зүүн + баруун, 3 → зүүн, төв, баруун.
 */
function toSlots(list: readonly ProductOption[]): Slots {
  const [a = null, b = null, c = null] = list;
  if (list.length === 1) return [null, a, null];
  if (list.length === 2) return [a, null, b];
  return [a, b, c];
}

const optionLabel = (p: ProductOption) =>
  p.brand ? `${p.brand} ${p.name}` : p.name;

/**
 * Hero-д оруулах үнэртэн (ихдээ 3, plan §17): тогтмол гурван сонгогч — зүүн,
 * төв, баруун. Хоосон бол одоогийн hero-гийн бараагаар restyle. Тэдний зураг
 * (AI лавлах эсвэл барааны эхний зураг) reference-ийн эхэнд орно.
 */
function ProductSlots({
  slots,
  onChange,
  picker,
}: {
  slots: Slots;
  onChange: (slots: Slots) => void;
  /** Гурвуулаа нэг хайлтыг хуваалцана — нэг удаад нэг л popup нээгдэнэ. */
  picker: ReturnType<typeof useProductOptions>;
}) {
  const any = slots.some(Boolean);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm leading-none font-medium">
        Баннерт гарах үнэртэн
      </legend>
      <div className="grid gap-2 pt-1 sm:grid-cols-3">
        {POSITION.map((pos, i) => (
          <SlotPicker
            key={pos}
            position={pos}
            value={slots[i]}
            taken={slots.flatMap((p, j) => (p && j !== i ? [p.id] : []))}
            picker={picker}
            onChange={(next) => {
              const copy = [...slots] as Slots;
              copy[i] = next;
              onChange(copy);
            }}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs text-pretty">
        {any
          ? "Зүүнээс баруун тийш зэрэгцэнэ. Хоосон байрлал алгасна."
          : "Сонгохгүй бол одоогийн савнууд хэвээр, уур амьсгал л солигдоно."}
      </p>
    </fieldset>
  );
}

/** Нэг байрлалын хайлттай сонгогч (сервер дээр хайна). */
function SlotPicker({
  position,
  value,
  taken,
  picker,
  onChange,
}: {
  position: string;
  value: ProductOption | null;
  /** Бусад байрлалд сонгосон — давхар сонгогдохгүй. */
  taken: string[];
  picker: ReturnType<typeof useProductOptions>;
  onChange: (next: ProductOption | null) => void;
}) {
  const { q, setQ, items, loading, loadFirstPage } = picker;
  const list = React.useMemo(() => {
    const free = items.filter((p) => !taken.includes(p.id));
    return value && !free.some((p) => p.id === value.id)
      ? [value, ...free]
      : free;
  }, [items, taken, value]);

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs">{position}</p>
      <div className="flex items-center gap-1">
        <Combobox
          items={list}
          value={value}
          onValueChange={(next: ProductOption | null) => onChange(next ?? null)}
          itemToStringLabel={optionLabel}
          isItemEqualToValue={(a: ProductOption, b: ProductOption) =>
            a.id === b.id
          }
          filter={null}
          inputValue={q}
          onInputValueChange={setQ}
          onOpenChange={(open) => {
            if (open) loadFirstPage();
            else setQ("");
          }}
        >
          <ComboboxTrigger
            aria-label={`${position} байрлалын үнэртэн`}
            className="h-10 min-w-0 flex-1 rounded-md"
          >
            <ComboboxValue placeholder="Хоосон" />
          </ComboboxTrigger>
          <PickerPopup aria-busy={loading || undefined}>
            <ComboboxInput
              placeholder="Нэр, брэндээр хайх"
              aria-label={`${position} байрлалд үнэртэн хайх`}
            />
            <ComboboxScroll>
              <ComboboxStatus>
                {loading && (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Хайж байна…
                  </>
                )}
              </ComboboxStatus>
              <ComboboxEmpty>
                {!loading && "Ийм үнэртэн олдсонгүй."}
              </ComboboxEmpty>
              <ComboboxList>
                {(p: ProductOption) => (
                  <ComboboxItem key={p.id} value={p}>
                    <span className="text-muted-foreground mr-2 shrink-0 text-xs uppercase">
                      {p.brand}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxScroll>
          </PickerPopup>
        </Combobox>
        {value && (
          <button
            type="button"
            aria-label={`${position} байрлалыг хоослох`}
            className="text-muted-foreground hover:text-foreground grid size-9 shrink-0 place-items-center rounded-md"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Текстийн бүсийн ХИЛ — зөвхөн тасархай шугам (+ шошго). Бүсийг будахгүй:
 * будалт зургийн жинхэнэ өнгийг өөрчилж харуулдаг байв (бараан хана цайвар
 * мэт). Шугамын зүүн талд нүүрний гарчиг, товч сууна.
 */
function SafeZoneLine({
  target,
  labelled = false,
}: {
  target: "desktop" | "mobile";
  labelled?: boolean;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0"
      style={{ width: `${SAFE_ZONE[target]}%` }}
    >
      {/* `difference` — цайвар хана дээр бараан, бараан дээр цайвар харагдана. */}
      <span className="absolute inset-y-0 right-0 border-r-2 border-dashed border-white mix-blend-difference" />
      {labelled && (
        <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
          ← Текстийн бүс
        </span>
      )}
    </div>
  );
}
