"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/shared/loading-button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useFeatureFlag } from "@/components/feature-flags";
import { DatePicker } from "@/features/admin/components/date-picker";
import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import { adminFetch } from "@/features/admin/lib/mutate";
import { HERO_LIMITS, SEASON_LABEL } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { heroInputSchema } from "@/lib/validators/hero";
import { heroCanvasMissing } from "../canvas-model";
import { daysInMonth, heroPagePayload, toMd, type HeroPageDraft } from "../hero-page-model";
import { targetOutsidePeriod } from "../lib";
import { heroLinkOptions } from "../link-presets";
import type { HeroEventOption } from "../types";
import { HeroCanvasEditor } from "./hero-canvas-editor";

const BOARD = "/admin/heroes";

/**
 * Улирлын / тусгай өдрийн баннерын засвар (studio-ux.md §7) — арга хэмжээний
 * студийн ④-тэй ЯГ ТЭР `HeroCanvasEditor` + цөөн нэмэлт талбар. Хадгалалт
 * гараар («Хадгалах»); одоо нүүрэнд гарч буй баннерыг засвал баталгаажуулна (D9).
 */
export function HeroPageEditor({
  initial,
  id: initialId,
  groupId: initialGroup,
  productIds,
  live,
  published,
  events,
  aiConfigured,
}: {
  initial: HeroPageDraft;
  id: string | null;
  groupId: string;
  productIds: string[];
  /** Одоо нүүр хуудсанд гарч байна. */
  live: boolean;
  /** Тусгай өдрийн баннер нийтлэгдсэн эсэх. */
  published: boolean;
  events: HeroEventOption[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const giftCards = useFeatureFlag("gift_cards");
  const [draft, setDraft] = React.useState(initial);
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(initial));
  const [id, setId] = React.useState(initialId);
  const [busy, setBusy] = React.useState<"save" | "publish" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /**
   * Хадгалах гэж оролдсон эсэх. Шинэ (хадгалагдаагүй) баннерт «Гарчиг хоосон»
   * г.м. улаан алдааг анх нээхэд биш, оролдсоны дараа л харуулна.
   */
  const [attempted, setAttempted] = React.useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const isSeason = draft.kind === "season";

  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const linkOptions = React.useMemo(
    () =>
      heroLinkOptions({
        isEnabled: (f) => f === "gift_cards" && giftCards,
        events: isSeason ? undefined : events.map((e) => ({ slug: e.slug, name: e.name })),
      }),
    [giftCards, isSeason, events],
  );

  // Тусгай өдөр: товчны арга хэмжээ баннерын хугацаанд явахгүй бол (F2).
  const outside = React.useMemo(() => {
    if (draft.kind !== "special") return null;
    const start = dayStartIso(draft.startsOn);
    const end = dayEndIso(draft.endsOn);
    const period = start && end ? { startsAt: start, endsAt: end } : null;
    return (
      targetOutsidePeriod(period, draft.canvas.primaryTarget, events) ??
      targetOutsidePeriod(period, draft.canvas.secondaryTarget, events)
    );
  }, [draft, events]);

  async function save(publish: boolean) {
    setAttempted(true);
    const payload = heroPagePayload(draft, { publish, productIds });
    const parsed = heroInputSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Шалгана уу.";
      setError(msg);
      toast.error(msg, "Хадгалагдсангүй");
      return;
    }
    const willShow = isSeason ? parsed.data.isActive : publish;
    if (live && willShow) {
      const ok = await confirm({
        title: "Одоо нүүр хуудсанд шууд солигдоно",
        description: "Энэ баннер яг одоо нүүр хуудсанд гарч байна. Хадгалмагц дэлгүүрт солигдоно.",
        confirmLabel: "Хадгалах",
      });
      if (!ok) return;
    } else if (live && !willShow) {
      const ok = await confirm({
        title: "Нүүр хуудаснаас буух уу?",
        description: isSeason
          ? "Баннер дутуу тул хадгалмагц нүүр хуудаснаас буух ба өмнөх улирлын баннер гарна."
          : "Ноорог болгомогц нүүр хуудаснаас буух ба улирлын баннер гарна.",
        confirmLabel: "Хадгалах",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(publish ? "publish" : "save");
    setError(null);
    try {
      const res = await adminFetch<{ id?: string }>(id ? `/api/admin/heroes/${id}` : "/api/admin/heroes", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error, "Хадгалагдсангүй");
        return;
      }
      setBaseline(JSON.stringify(draft));
      toast.success("Хадгалагдлаа.");
      if (!id && res.data.id) {
        setId(res.data.id);
        if (!isSeason) router.replace(`${BOARD}/${res.data.id}`);
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!id) return;
    const ok = await confirm({
      title: "Баннерыг устгах уу?",
      description: "Устгасан баннерыг сэргээх боломжгүй.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusy("delete");
    try {
      const res = await adminFetch(`/api/admin/heroes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(res.error, "Устгасангүй");
        return;
      }
      setBaseline(JSON.stringify(draft));
      router.push(BOARD);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function leave(e: React.MouseEvent) {
    if (!dirty || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const ok = await confirm({
      title: "Хадгалаагүй өөрчлөлт байна",
      description: "Гарвал сүүлд хийсэн өөрчлөлт тань хадгалагдахгүй.",
      confirmLabel: "Гарах",
      cancelLabel: "Үлдэх",
      destructive: true,
    });
    if (ok) router.push(BOARD);
  }

  const title =
    draft.kind === "season"
      ? `${SEASON_LABEL[draft.season]} — улирлын баннер`
      : draft.name.trim() || "Тусгай өдрийн баннер";
  const [month, day] = draft.kind === "season" ? draft.startMd.split("-").map(Number) : [1, 1];
  // Дутуу зүйлс: тусгай өдөрт нийтлэхэд нэр, хугацаа ч хэрэгтэй.
  const missing = [
    ...(draft.kind === "special" && !draft.name.trim() ? ["нэр"] : []),
    ...(draft.kind === "special" && !draft.startsOn ? ["эхлэх өдөр"] : []),
    ...(draft.kind === "special" && !draft.endsOn ? ["дуусах өдөр"] : []),
    ...heroCanvasMissing(draft.canvas),
  ];
  const complete = missing.length === 0;
  // Нийтлээгүй тусгай баннерыг дутуу үед нийтлэхгүй — шалтгаан нь доорх шар мөрөнд.
  const publishBlocked = draft.kind === "special" && !published && !complete;
  const status = dirty
    ? "Хадгалаагүй өөрчлөлт"
    : live
      ? "Одоо нүүр хуудсанд"
      : !complete
        ? "Дутуу"
        : id
          ? "Хадгалагдсан"
          : "Шинэ";

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Утсанд нэг мөрөнд: буцах дүрс · богино гарчиг · төлөв · товч (өмнө нь
          гарчиг «Намар — улирлын…» болж тасарч, товч доод мөрөнд унадаг байв). */}
      <header className="bg-card field-edge sticky top-16 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-3 sm:gap-x-4 sm:px-4 lg:top-2">
        <Link
          href={BOARD}
          onClick={(e) => void leave(e)}
          aria-label="Нүүрний баннер руу буцах"
          className="text-muted-foreground hover:text-foreground -m-1 inline-flex items-center gap-1.5 p-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Нүүрний баннер</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-serif text-xl font-semibold sm:basis-48">
          {draft.kind === "season" ? (
            <>
              <span className="sm:hidden">{SEASON_LABEL[draft.season]}</span>
              <span className="hidden sm:inline">{title}</span>
            </>
          ) : (
            title
          )}
        </h1>
        <p
          className={cn(
            "text-sm whitespace-nowrap",
            status === "Дутуу" ? "text-warning" : "text-muted-foreground",
          )}
        >
          {status}
        </p>
        {draft.kind === "special" && (
          <LoadingButton
            type="button"
            size="sm"
            variant="secondary"
            loading={busy === "save"}
            disabled={busy !== null || (!dirty && !published && id !== null)}
            onClick={() => void save(false)}
          >
            {published ? "Ноорог болгох" : "Ноорог хадгалах"}
          </LoadingButton>
        )}
        <LoadingButton
          type="button"
          size="sm"
          loading={busy === (isSeason ? "save" : "publish")}
          disabled={busy !== null || (isSeason && !dirty && id !== null) || publishBlocked}
          aria-describedby={!complete ? "hero-missing" : undefined}
          className="bg-cta text-cta-foreground hover:bg-cta/90"
          onClick={() => void save(!isSeason)}
        >
          {isSeason ? "Хадгалах" : published ? "Хадгалах" : "Нийтлэх"}
        </LoadingButton>
      </header>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <section className="bg-card space-y-6 rounded-xl p-4 sm:p-6">
        {draft.kind === "season" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Эхлэх өдөр</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(month)}
                onValueChange={(v) =>
                  setDraft((d) => (d.kind === "season" ? { ...d, startMd: toMd(Number(v), day) } : d))
                }
              >
                <SelectTrigger className="w-32" aria-label="Сар">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {i + 1}-р сар
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(day)}
                onValueChange={(v) =>
                  setDraft((d) => (d.kind === "season" ? { ...d, startMd: toMd(month, Number(v)) } : d))
                }
              >
                <SelectTrigger className="w-24" aria-label="Өдөр">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInMonth(month) }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-sm text-pretty">
              Жил бүр энэ өдрөөс эхэлж, дараагийн бэлэн улирал эхлэх хүртэл гарна. Зураг бүрэн биш бол
              өмнөх улирлын баннер үргэлжилнэ.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Нэр" hint="Зөвхөн админд.">
              <Input
                value={draft.name}
                maxLength={HERO_LIMITS.name}
                placeholder="Halloween 2026"
                onChange={(e) =>
                  setDraft((d) => (d.kind === "special" ? { ...d, name: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Эхлэх өдөр" hint="00:00-оос">
              <DatePicker
                value={draft.startsOn}
                clearable={false}
                onChange={(v) => setDraft((d) => (d.kind === "special" ? { ...d, startsOn: v } : d))}
              />
            </Field>
            <Field label="Дуусах өдөр" hint="23:59 хүртэл">
              <DatePicker
                value={draft.endsOn}
                clearable={false}
                min={draft.startsOn || undefined}
                onChange={(v) => setDraft((d) => (d.kind === "special" ? { ...d, endsOn: v } : d))}
              />
            </Field>
          </div>
        )}

        {!complete && (
          <p
            id="hero-missing"
            className="text-warning flex items-start gap-1.5 text-sm text-pretty"
            role="status"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              Дутуу: {missing.join(", ")}.{" "}
              {isSeason
                ? "Бүрэн болмогц нүүр хуудсанд гарна, тэр болтол өмнөх улирлынх үргэлжилнэ."
                : "Бүрэн болмогц нийтэлж болно."}
            </span>
          </p>
        )}
        {outside && (
          <p className="text-warning text-sm text-pretty" role="status">
            Товчны арга хэмжээ «{outside.name}» энэ баннерын бүх хугацаанд явахгүй — тэр өдрүүдэд
            баннер нүүр хуудсанд гарахгүй.
          </p>
        )}

        <HeroCanvasEditor
          value={draft.canvas}
          onChange={(canvas) => setDraft((d) => ({ ...d, canvas }))}
          linkOptions={linkOptions}
          groupId={initialGroup}
          heroId={id}
          aiConfigured={aiConfigured}
          defaultTheme={draft.kind === "season" ? draft.season : "custom"}
          defaultProducts={[]}
          altPlaceholder={`Хоосон бол «${title} — нүүрний баннер»`}
          showInvalid={attempted || id !== null}
        />
      </section>

      {draft.kind === "special" && id && (
        <div className="flex justify-end">
          <LoadingButton
            type="button"
            variant="ghost"
            className="text-destructive"
            loading={busy === "delete"}
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            <Trash2 />
            Баннерыг устгах
          </LoadingButton>
        </div>
      )}
    </div>
  );
}
