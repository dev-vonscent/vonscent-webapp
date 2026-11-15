"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  Copy,
  ImagePlus,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { fieldErrorClass } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingButton } from "@/components/shared/loading-button";
import { PageHeader } from "@/components/shared/page-header";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DatePicker } from "@/features/admin/components/date-picker";
import { FormDrawer } from "@/features/admin/components/form-drawer";
import { isoEndToDay, isoToDay } from "@/features/admin/lib/date-range";
import { adminFetch, mutate, mutateJson } from "@/features/admin/lib/mutate";
import { formatEventPeriod } from "@/features/sale-events/lib";
import { HERO_LIMITS as L, SEASON_LABEL } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  heroFieldErrors,
  heroInputSchema,
  type HeroInput,
} from "@/lib/validators/hero";
import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import {
  eventOptionStatus,
  heroAt,
  heroPeriod,
  heroSchedule,
  heroTargetBlock,
  heroTargetBlockText,
  heroTargetHref,
  heroToCampaign,
  targetOutsidePeriod,
  ubMonthDay,
} from "../lib";
import { HeroAiPanel } from "./hero-ai-panel";
import { ImageUpload } from "./hero-image-upload";
import type {
  HeroAdminRow,
  HeroDesktopImage,
  HeroEventOption,
  HeroMobileImage,
  HeroTarget,
} from "../types";
import {
  HERO_PREVIEW_MESSAGE,
  HERO_PREVIEW_SIZE,
} from "./hero-preview-frame";

/**
 * Админ → Сайт → Нүүрний hero (0182, docs/campaigns/plan.md §7, §9.2).
 *
 * Нэг hero = текст, хоёр товч, зураг, хуваарь. Хуваарьт хамгийн өндөр
 * priority-тэй идэвхтэй hero гарна; хоосон өдөр кодын hero (улирлын).
 * Арга хэмжээтэй холбосон hero нь тэр арга хэмжээний хугацаагаар асна.
 */
export function HeroAdmin({
  rows,
  events,
  aiConfigured,
}: {
  rows: HeroAdminRow[];
  events: HeroEventOption[];
  /** `OPENAI_API_KEY` тохируулсан эсэх — AI самбар (0183). */
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => setNow(Date.now()), []);

  async function toggle(h: HeroAdminRow) {
    setBusyId(h.id);
    try {
      const ok = await mutateJson(
        `/api/admin/heroes/${h.id}`,
        "PATCH",
        { isActive: !h.isActive },
        h.isActive ? "Нуусангүй" : "Нийтэлсэнгүй",
      );
      if (!ok) return;
      toast.success(h.isActive ? `«${h.name}» нуугдлаа.` : `«${h.name}» нийтлэгдлээ.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(h: HeroAdminRow) {
    const ok = await confirm({
      title: `«${h.name}»-г устгах уу?`,
      description: h.isActive
        ? "Идэвхтэй hero — устгавал хуваарьт дараагийн hero эсвэл кодын hero гарна."
        : "Бүрэн устгагдана.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(h.id);
    try {
      if (
        !(await mutate(`/api/admin/heroes/${h.id}`, { method: "DELETE" }, "Устгасангүй"))
      )
        return;
      toast.success("Hero устлаа.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const schedule = now == null ? [] : heroSchedule(rows, events, now);
  // Яг одоо дэлгүүрт гарч буй ганц hero (`live_hero()`-ийн дүрэм).
  const liveId = now == null ? null : (heroAt(rows, events, now)?.id ?? null);

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Нүүрний hero"
        count={rows.length}
        description="Нүүр хуудасны том зураг, гарчиг, товч. Хуваарьт хамгийн өндөр эрэмбэтэй идэвхтэй hero гарна; хоосон өдөр улирлын (кодын) hero."
        actions={
          rows.length > 0 && (
            <Button size="sm" onClick={() => setEditing({ mode: "new" })}>
              <Plus className="size-4" />
              Hero нэмэх
            </Button>
          )
        }
      />

      {schedule.length > 0 && (
        <section className="bg-card space-y-2 rounded-lg p-4">
          <h2 className="text-sm font-semibold">Ирэх 90 хоног</h2>
          <ol className="space-y-1 text-sm">
            {schedule.map((s) => (
              <li
                key={`${s.from}-${s.heroId}`}
                className={cn(
                  "flex flex-wrap gap-x-3 tabular-nums",
                  !s.heroId && "text-muted-foreground",
                )}
              >
                <span className="w-44 shrink-0">
                  {s.from === s.to ? s.from : `${s.from} — ${s.to}`}
                </span>
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          surface="card"
          title="Hero хараахан алга"
          description="Одоо нүүрэнд улирлын (кодын) hero гарч байна. Black Friday, Цагаан сар г.м. үед өөрийн текст, зурагтай hero нэмээрэй."
          action={
            <Button size="sm" onClick={() => setEditing({ mode: "new" })}>
              <Plus className="size-4" />
              Hero нэмэх
            </Button>
          }
        />
      ) : (
        <ul role="list" className="space-y-3">
          {rows.map((h) => (
            <li key={h.id}>
              <HeroCard
                hero={h}
                events={events}
                now={now}
                live={liveId === h.id}
                busy={busyId === h.id}
                onEdit={() => setEditing({ mode: "edit", row: h })}
                onCopy={() => setEditing({ mode: "copy", row: h })}
                onToggle={() => toggle(h)}
                onRemove={() => remove(h)}
              />
            </li>
          ))}
        </ul>
      )}

      <HeroForm
        editing={editing}
        events={events}
        now={now}
        aiConfigured={aiConfigured}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function HeroCard({
  hero: h,
  events,
  now,
  live,
  busy,
  onEdit,
  onCopy,
  onToggle,
  onRemove,
}: {
  hero: HeroAdminRow;
  events: HeroEventOption[];
  now: number | null;
  live: boolean;
  busy: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const period = heroPeriod(h, events);
  const event = h.saleEventId
    ? events.find((e) => e.id === h.saleEventId)
    : null;
  // Хугацаандаа байгаа (эсвэл ирээдүйд эхлэх) нийтэлсэн hero-гийн товч LIVE
  // биш арга хэмжээ рүү заавал дэлгүүрт гарахгүй — шалтгааныг харуулна
  // (fixes F2). Хугацаандаа бол «Хүлээгдэж байна».
  const inPeriod =
    now != null &&
    h.isActive &&
    period != null &&
    period.eventActive &&
    Date.parse(period.startsAt) <= now &&
    now < Date.parse(period.endsAt);
  const notEnded =
    now != null && period != null && now < Date.parse(period.endsAt);
  const block =
    now != null && h.isActive && period != null && notEnded
      ? heroTargetBlock(
          h,
          events,
          Math.max(now, Date.parse(period.startsAt)),
        )
      : null;
  const thumb = h.desktopImage ? `${h.desktopImage.base}-1600.webp` : null;
  return (
    <Card className={cn(!h.isActive && "bg-card/60")}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="bg-muted aspect-14/5 w-full shrink-0 overflow-hidden rounded-md sm:w-56">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element -- жижиг thumbnail, storage URL
            <img src={thumb} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold wrap-break-word">{h.name}</h2>
            {live ? (
              <Badge variant="new">Одоо гарч байна</Badge>
            ) : inPeriod && block ? (
              <Badge variant="outline">Хүлээгдэж байна</Badge>
            ) : h.isActive ? (
              <Badge variant="gold">Нийтэлсэн</Badge>
            ) : (
              <Badge variant="outline">Ноорог</Badge>
            )}
            {h.priority !== 0 && (
              <Badge variant="secondary">Эрэмбэ {h.priority}</Badge>
            )}
          </div>
          <p className="text-sm wrap-break-word">{h.title}</p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarRange className="size-3.5" />
              {period
                ? formatEventPeriod(period.startsAt, period.endsAt)
                : "Хугацаагүй"}
              {event && ` · «${event.name}»`}
              {event && !event.isActive && " (ноорог)"}
            </span>
            <span>→ {heroTargetHref(h.primaryTarget)}</span>
          </p>
          {block && (
            <p className="text-warning text-xs">{heroTargetBlockText(block)}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-1">
          <Button
            variant={h.isActive ? "outline" : "default"}
            size="sm"
            disabled={busy || (!h.isActive && (!h.desktopImage || !h.mobileImage))}
            onClick={onToggle}
          >
            {h.isActive ? (
              <>
                <PowerOff className="size-4" /> Нуух
              </>
            ) : (
              <>
                <Power className="size-4" /> Нийтлэх
              </>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`«${h.name}»-г засах`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopy}
            aria-label={`«${h.name}»-г хуулж шинэ ноорог үүсгэх`}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onRemove}
            aria-label={`«${h.name}»-г устгах`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Маягт ───────────────────────────────────────────────────────────────

type Editing =
  | { mode: "new" }
  | { mode: "edit"; row: HeroAdminRow }
  | { mode: "copy"; row: HeroAdminRow };

const FORM_ID = "hero-form";

interface Draft {
  /** Зургийн хавтас (`hero/<groupId>/…`) — шинэ hero-д client uuid. */
  groupId: string;
  name: string;
  scheduleMode: "dates" | "event";
  saleEventId: string;
  startsOn: string;
  endsOn: string;
  priority: string;
  eyebrow: string;
  title: string;
  description: string;
  mobileDescription: string;
  primaryLabel: string;
  primaryTarget: HeroTarget;
  secondaryLabel: string;
  secondaryTarget: HeroTarget | null;
  desktopImage: HeroDesktopImage | null;
  mobileImage: HeroMobileImage | null;
  imageAlt: string;
  dark: boolean;
}

function toDraft(editing: Editing): Draft {
  if (editing.mode === "new") {
    return {
      groupId: crypto.randomUUID(),
      name: "",
      scheduleMode: "dates",
      saleEventId: "",
      startsOn: "",
      endsOn: "",
      priority: "0",
      eyebrow: "",
      title: "",
      description: "",
      mobileDescription: "",
      primaryLabel: "",
      primaryTarget: { type: "catalog", query: "" },
      secondaryLabel: "Бүх үнэртэн",
      secondaryTarget: { type: "path", href: "/catalog" },
      desktopImage: null,
      mobileImage: null,
      imageAlt: "",
      dark: false,
    };
  }
  const r = editing.row;
  const copy = editing.mode === "copy";
  return {
    groupId: copy ? crypto.randomUUID() : r.id,
    name: copy ? `${r.name} (хуулбар)`.slice(0, L.name) : r.name,
    scheduleMode: r.saleEventId && !copy ? "event" : "dates",
    saleEventId: copy ? "" : (r.saleEventId ?? ""),
    // Хуулахад огноо хоосон (plan §9.3).
    startsOn: copy ? "" : isoToDay(r.startsAt),
    endsOn: copy ? "" : isoEndToDay(r.endsAt),
    priority: String(r.priority),
    eyebrow: r.eyebrow,
    title: r.title,
    description: r.description,
    mobileDescription: r.mobileDescription ?? "",
    primaryLabel: r.primaryLabel,
    primaryTarget: r.primaryTarget,
    secondaryLabel: r.secondaryLabel ?? "",
    secondaryTarget: r.secondaryTarget,
    desktopImage: r.desktopImage,
    mobileImage: r.mobileImage,
    imageAlt: r.imageAlt,
    dark: r.dark,
  };
}

function toInput(d: Draft, isActive: boolean): unknown {
  const linked = d.scheduleMode === "event" && d.saleEventId;
  return {
    name: d.name,
    saleEventId: linked ? d.saleEventId : null,
    startsOn: linked ? null : d.startsOn || null,
    endsOn: linked ? null : d.endsOn || null,
    priority: d.priority.trim() === "" ? 0 : Number(d.priority),
    isActive,
    eyebrow: d.eyebrow,
    title: d.title,
    description: d.description,
    mobileDescription: d.mobileDescription,
    primaryLabel: d.primaryLabel,
    primaryTarget: d.primaryTarget,
    secondaryLabel: d.secondaryLabel,
    secondaryTarget: d.secondaryLabel.trim() ? d.secondaryTarget : null,
    desktopImage: d.desktopImage,
    mobileImage: d.mobileImage,
    imageAlt: d.imageAlt,
    dark: d.dark,
  };
}

function HeroForm({
  editing,
  events,
  now,
  aiConfigured,
  onClose,
  onSaved,
}: {
  editing: Editing | null;
  events: HeroEventOption[];
  now: number | null;
  aiConfigured: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [initial, setInitial] = React.useState("");
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof HeroInput, string>>
  >({});
  const [busy, setBusy] = React.useState<"draft" | "publish" | null>(null);
  const [titleLines, setTitleLines] = React.useState(0);

  React.useEffect(() => {
    if (!editing) return;
    const next = toDraft(editing);
    setDraft(next);
    setInitial(JSON.stringify(next));
    setErrors({});
  }, [editing]);

  const isEdit = editing?.mode === "edit";
  const published = isEdit && editing.row.isActive;

  // Hero-гийн хугацаа (өөрийн эсвэл холбосон арга хэмжээний) — товчны арга
  // хэмжээний анхааруулгад (fixes F2).
  const draftPeriod = React.useMemo(() => {
    if (!draft) return null;
    if (draft.scheduleMode === "event") {
      const e = events.find((x) => x.id === draft.saleEventId);
      return e ? { startsAt: e.startsAt, endsAt: e.endsAt } : null;
    }
    const startsAt = dayStartIso(draft.startsOn);
    const endsAt = dayEndIso(draft.endsOn);
    return startsAt && endsAt ? { startsAt, endsAt } : null;
  }, [draft, events]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function save(isActive: boolean) {
    if (!draft || !editing) return;
    const parsed = heroInputSchema.safeParse(toInput(draft, isActive));
    if (!parsed.success) {
      setErrors(heroFieldErrors(parsed.error));
      toast.error(parsed.error.issues[0]?.message ?? "Маягтаа шалгана уу.");
      return;
    }
    setBusy(isActive ? "publish" : "draft");
    try {
      const res = await adminFetch(
        isEdit ? `/api/admin/heroes/${editing.row.id}` : "/api/admin/heroes",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!res.ok) {
        toast.error(res.error, "Хадгалагдсангүй");
        return;
      }
      toast.success(isActive ? "Hero нийтлэгдлээ." : "Ноорог хадгалагдлаа.");
      onSaved();
    } finally {
      setBusy(null);
    }
  }

  const dirty = draft !== null && JSON.stringify(draft) !== initial;
  const previewCampaign = React.useMemo(() => {
    if (!draft?.desktopImage || !draft.mobileImage) return null;
    return heroToCampaign({
      id: "preview",
      eyebrow: draft.eyebrow,
      title: draft.title || "Гарчиг",
      description: draft.description,
      mobileDescription: draft.mobileDescription || null,
      primaryLabel: draft.primaryLabel || "Товч",
      primaryTarget: draft.primaryTarget,
      secondaryLabel: draft.secondaryLabel || null,
      secondaryTarget: draft.secondaryLabel ? draft.secondaryTarget : null,
      desktopImage: draft.desktopImage,
      mobileImage: draft.mobileImage,
      imageAlt: draft.imageAlt,
      dark: draft.dark,
    });
  }, [draft]);

  return (
    <FormDrawer
      open={editing !== null}
      dirty={dirty}
      onClose={onClose}
      wide
      title={
        editing?.mode === "edit"
          ? "Hero засах"
          : editing?.mode === "copy"
            ? "Хуулж шинэ hero"
            : "Hero нэмэх"
      }
      description="Ноорог нүүрэнд гарахгүй. Нийтэлсэн hero хугацаандаа, хамгийн өндөр эрэмбэтэй бол гарна."
      discardDescription="Бөглөсөн мэдээлэл, оруулсан зураг тань энэ hero-д хадгалагдахгүй."
      footer={
        <>
          <LoadingButton
            type="button"
            variant="outline"
            loading={busy === "draft"}
            disabled={busy !== null}
            onClick={() => save(false)}
          >
            {published ? "Ноорог болгох" : "Ноорог хадгалах"}
          </LoadingButton>
          <LoadingButton
            type="submit"
            form={FORM_ID}
            loading={busy === "publish"}
            disabled={busy !== null}
          >
            {published ? "Хадгалах" : "Нийтлэх"}
          </LoadingButton>
        </>
      }
    >
      {draft && (
        <form
          id={FORM_ID}
          noValidate
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          {/* ── Урьдчилж харах ─────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Урьдчилж харах</h3>
            {previewCampaign ? (
              <HeroPreviews
                campaign={previewCampaign}
                onTitleLines={setTitleLines}
              />
            ) : (
              <p className="text-muted-foreground bg-secondary/40 rounded-md p-4 text-center text-sm">
                Desktop ба утасны зураг оруулахад энд дэлгүүрт гарах байдлаар
                харагдана.
              </p>
            )}
            {titleLines > 2 && (
              <p className="text-destructive text-xs" role="status">
                Гарчиг desktop дээр {titleLines} мөр болж байна — 2 мөрөнд
                багтаахаар богиносгоно уу.
              </p>
            )}
          </section>

          {/* ── Зураг ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Зураг</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload
                kind="desktop"
                label="Desktop (2.8:1, жишээ 3584×1280)"
                groupId={draft.groupId}
                preview={
                  draft.desktopImage
                    ? `${draft.desktopImage.base}-1600.webp`
                    : null
                }
                error={errors.desktopImage}
                onUploaded={(r) => {
                  if (r.desktop) set("desktopImage", r.desktop);
                  if (r.suggestDark !== draft.dark) {
                    toast.success(
                      r.suggestDark
                        ? "Зургийн зүүн тал бараан тул текстийг цагаан болголоо."
                        : "Зургийн зүүн тал цайвар тул текстийг бараан болголоо.",
                    );
                    set("dark", r.suggestDark);
                  }
                }}
              />
              <ImageUpload
                kind="mobile"
                label="Утас (4:3, жишээ 2048×1536)"
                groupId={draft.groupId}
                preview={draft.mobileImage?.src ?? null}
                onUploaded={(r) => r.mobile && set("mobileImage", r.mobile)}
              />
            </div>
            <HeroAiPanel
              groupId={draft.groupId}
              heroId={isEdit ? editing.row.id : null}
              configured={aiConfigured}
              onUse={(r) => {
                if (r.desktop) set("desktopImage", r.desktop);
                if (r.mobile) set("mobileImage", r.mobile);
                // Desktop-ын зүүн тал (текстийн бүс) л текстийн өнгийг шийднэ.
                if (r.desktop && r.suggestDark !== draft.dark) set("dark", r.suggestDark);
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Зургийн тайлбар (alt)"
                hint="Хараагүй хэрэглэгч, Google-д. Жишээ: «Layton, Aventus болон decant савнууд»."
              >
                <Input
                  value={draft.imageAlt}
                  maxLength={L.imageAlt}
                  onChange={(e) => set("imageAlt", e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-3 self-end pb-2 text-sm">
                <Checkbox
                  checked={draft.dark}
                  onCheckedChange={(v) => set("dark", v === true)}
                />
                Бараан хана — цагаан текст
              </label>
            </div>
          </section>

          {/* ── Текст ──────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Текст</h3>
            <CountedInput
              label="Жижиг гарчиг"
              value={draft.eyebrow}
              max={L.eyebrow}
              placeholder="Black Friday · 11/23–11/30"
              error={errors.eyebrow}
              onChange={(v) => set("eyebrow", v)}
            />
            <CountedInput
              label="Гарчиг"
              value={draft.title}
              max={L.title}
              placeholder="Жилийн хамгийн том хямдрал"
              error={errors.title}
              onChange={(v) => set("title", v)}
            />
            <CountedInput
              label="Тайлбар (desktop)"
              value={draft.description}
              max={L.description}
              error={errors.description}
              onChange={(v) => set("description", v)}
            />
            <CountedInput
              label="Утасны богино тайлбар"
              hint="Хоосон бол desktop-ийнх."
              value={draft.mobileDescription}
              max={L.mobileDescription}
              error={errors.mobileDescription}
              onChange={(v) => set("mobileDescription", v)}
            />
          </section>

          {/* ── Товч ───────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Товч</h3>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <CountedInput
                label="Үндсэн товч"
                value={draft.primaryLabel}
                max={L.buttonLabel}
                placeholder="Хямдралыг үзэх"
                error={errors.primaryLabel}
                onChange={(v) => set("primaryLabel", v)}
              />
              <TargetPicker
                value={draft.primaryTarget}
                events={events}
                now={now}
                period={draftPeriod}
                error={errors.primaryTarget}
                onChange={(t) => set("primaryTarget", t)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <CountedInput
                label="Хоёр дахь товч"
                hint="Хоосон бол гарахгүй. Зөвхөн desktop."
                value={draft.secondaryLabel}
                max={L.buttonLabel}
                error={errors.secondaryLabel}
                onChange={(v) => set("secondaryLabel", v)}
              />
              {draft.secondaryLabel.trim() && (
                <TargetPicker
                  value={
                    draft.secondaryTarget ?? { type: "path", href: "/catalog" }
                  }
                  events={events}
                  now={now}
                  period={draftPeriod}
                  error={errors.secondaryTarget}
                  onChange={(t) => set("secondaryTarget", t)}
                />
              )}
            </div>
          </section>

          {/* ── Хуваарь ────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Хуваарь</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Дотоод нэр" hint="Зөвхөн админд." error={errors.name}>
                <Input
                  value={draft.name}
                  maxLength={L.name}
                  placeholder="Black Friday 2026"
                  className={fieldErrorClass(errors.name)}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field
                label="Эрэмбэ"
                hint="Хоёр hero зэрэг бол их нь гарна (−100…100)."
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={-100}
                  max={100}
                  value={draft.priority}
                  onChange={(e) => set("priority", e.target.value)}
                />
              </Field>
            </div>
            {events.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["dates", "Өөрийн хугацаа"],
                    ["event", "Арга хэмжээтэй холбох"],
                  ] as const
                ).map(([mode, text]) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={draft.scheduleMode === mode ? "default" : "outline"}
                    onClick={() => set("scheduleMode", mode)}
                  >
                    {text}
                  </Button>
                ))}
              </div>
            )}
            {draft.scheduleMode === "event" && events.length > 0 ? (
              <Field
                label="Арга хэмжээ"
                hint="Hero нь арга хэмжээний хугацаагаар асаж унтарна; арга хэмжээ зогсвол hero ч."
                error={errors.startsOn}
              >
                <Select
                  value={draft.saleEventId}
                  onValueChange={(v) => set("saleEventId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} · {formatEventPeriod(e.startsAt, e.endsAt)}
                        {now != null && ` · ${eventOptionStatus(e, now)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Эхлэх өдөр" hint="00:00:00-оос" error={errors.startsOn}>
                  <DatePicker
                    value={draft.startsOn}
                    clearable={false}
                    onChange={(v) => set("startsOn", v)}
                  />
                </Field>
                <Field label="Дуусах өдөр" hint="23:59:59 хүртэл" error={errors.endsOn}>
                  <DatePicker
                    value={draft.endsOn}
                    clearable={false}
                    min={draft.startsOn || undefined}
                    onChange={(v) => set("endsOn", v)}
                  />
                </Field>
              </div>
            )}
          </section>
        </form>
      )}
    </FormDrawer>
  );
}

function CountedInput({
  label,
  hint,
  value,
  max,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  max: number;
  placeholder?: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field
      label={label}
      hint={`${hint ? `${hint} ` : ""}${value.length}/${max}`}
      error={error}
    >
      <Input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        className={fieldErrorClass(error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

const TARGET_LABEL: Record<HeroTarget["type"], string> = {
  event: "Арга хэмжээ",
  season: "Улирал",
  catalog: "Каталогийн шүүлт",
  path: "Дотоод хуудас",
};

/** Товчны холбоос сонгогч (plan §7.3) — гадаад хаяг бичих боломжгүй. */
function TargetPicker({
  value,
  events,
  now,
  period,
  error,
  onChange,
}: {
  value: HeroTarget;
  events: HeroEventOption[];
  now: number | null;
  period: { startsAt: string; endsAt: string } | null;
  error?: string;
  onChange: (t: HeroTarget) => void;
}) {
  const types = (Object.keys(TARGET_LABEL) as HeroTarget["type"][]).filter(
    (t) => t !== "event" || events.length > 0,
  );
  function setType(type: HeroTarget["type"]) {
    if (type === value.type) return;
    onChange(
      type === "event"
        ? { type, slug: events[0]?.slug ?? "" }
        : type === "season"
          ? { type, value: "winter" }
          : type === "catalog"
            ? { type, query: "" }
            : { type, href: "/" },
    );
  }
  const outside = targetOutsidePeriod(period, value, events);
  return (
    <Field
      label="Холбоос"
      hint={`→ ${heroTargetHref(value)}`}
      error={error}
    >
      <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={value.type}
          onValueChange={(v) => setType(v as HeroTarget["type"])}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {TARGET_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.type === "event" && (
          <Select
            value={value.slug}
            onValueChange={(slug) => onChange({ type: "event", slug })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Арга хэмжээ" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.slug}>
                  {e.name}
                  {now != null && ` · ${eventOptionStatus(e, now)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {value.type === "season" && (
          <Select
            value={value.value}
            onValueChange={(v) =>
              onChange({
                type: "season",
                value: v as Extract<HeroTarget, { type: "season" }>["value"],
              })
            }
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["spring", "summer", "autumn", "winter"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {SEASON_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {value.type === "catalog" && (
          <Input
            className="flex-1"
            value={value.query}
            placeholder="tags=new&gender=male"
            onChange={(e) => onChange({ type: "catalog", query: e.target.value })}
          />
        )}
        {value.type === "path" && (
          <Input
            className="flex-1"
            value={value.href}
            placeholder="/gift-cards"
            onChange={(e) => onChange({ type: "path", href: e.target.value })}
          />
        )}
      </div>
      {outside && (
        <p className="text-warning text-xs">
          {outside.isActive
            ? `Энэ hero зөвхөн «${outside.name}» явж байх үед (${ubMonthDay(outside.startsAt)}–${ubMonthDay(new Date(Date.parse(outside.endsAt) - 1).toISOString())}) гарна. Урьдчилсан зарлал бол товчийг каталог эсвэл өөр хуудас руу заана уу.`
            : `«${outside.name}» нийтлэгдээгүй (ноорог) — нийтлэх хүртэл энэ hero дэлгүүрт гарахгүй.`}
        </p>
      )}
      </div>
    </Field>
  );
}

const PREVIEW_WIDTHS = [
  { width: 390, label: "Утас 390" },
  { width: 768, label: "Таблет 768" },
  { width: 1440, label: "Desktop 1440" },
] as const;

/**
 * Жинхэнэ `CampaignHero`-г 3 өргөнд (plan §7.4). Breakpoint нь viewport-оор
 * тул iframe (`/admin/hero-preview`), панелд багтаахаар `scale`.
 */
function HeroPreviews({
  campaign,
  onTitleLines,
}: {
  campaign: ReturnType<typeof heroToCampaign>;
  onTitleLines: (n: number) => void;
}) {
  return (
    <div className="space-y-3">
      {PREVIEW_WIDTHS.map((p) => (
        <PreviewFrame
          key={p.width}
          width={p.width}
          label={p.label}
          campaign={campaign}
          onTitleLines={p.width === 1440 ? onTitleLines : undefined}
        />
      ))}
    </div>
  );
}

function PreviewFrame({
  width,
  label,
  campaign,
  onTitleLines,
}: {
  width: number;
  label: string;
  campaign: ReturnType<typeof heroToCampaign>;
  onTitleLines?: (n: number) => void;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(Math.round(width / 2.4));
  const [scale, setScale] = React.useState(1);

  // Панелийн өргөнд багтаах.
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const send = React.useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: HERO_PREVIEW_MESSAGE, campaign },
      window.location.origin,
    );
  }, [campaign]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as {
        type?: string;
        ready?: boolean;
        height?: number;
        titleLines?: number;
      };
      if (d?.type !== HERO_PREVIEW_SIZE) return;
      if (d.ready) send();
      if (d.height) setHeight(d.height);
      if (d.titleLines != null) onTitleLines?.(d.titleLines);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send, onTitleLines]);

  React.useEffect(() => send(), [send]);

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div
        ref={boxRef}
        className="bg-secondary/40 overflow-hidden rounded-md"
        style={{ height: Math.ceil(height * scale) }}
      >
        <iframe
          ref={frameRef}
          src="/admin/hero-preview"
          title={`Hero урьдчилж харах — ${label}`}
          width={width}
          height={height}
          className="origin-top-left border-0"
          style={{ transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
