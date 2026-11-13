"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  Copy,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Search,
  Square,
  Tag,
  Trash2,
  X,
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
import {
  isoEndToDay,
  isoToDay,
  ubToday,
} from "@/features/admin/lib/date-range";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import { slugify } from "@/features/collections/slug";
import {
  GENDERS,
  GENDER_LABEL,
  ML_SIZES,
  SALE_EVENT_LIMITS as L,
  SALE_EVENT_MAX_PCT,
} from "@/lib/constants";
import type { Gender } from "@/db/types";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { bulkSalePrice } from "@/lib/validators/sale";
import {
  saleEventFieldErrors,
  saleEventInputSchema,
  type SaleEventInput,
} from "@/lib/validators/sale-event";
import {
  SALE_EVENT_PHASE_LABEL,
  formatEventPeriod,
  saleEventPhase,
  type OverlapConflict,
} from "../lib";
import type { SaleEventAdminRow, SaleEventPhase } from "../types";

/** Сонгогчийн нэг бараа (хуудас серверээс өгнө). */
export interface SaleEventProduct {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  /** Идэвхтэй, үнэтэй хэмжээнүүд — ml → үндсэн үнэ. */
  prices: Record<number, number>;
}

const PHASE_BADGE: Record<
  SaleEventPhase,
  "new" | "secondary" | "outline" | "gold"
> = {
  live: "new",
  scheduled: "gold",
  ended: "secondary",
  draft: "outline",
};

/**
 * Админ → Каталог → Арга хэмжээ (0181, docs/campaigns/plan.md §9).
 *
 * Арга хэмжээ = нэртэй, хугацаатай хямдрал (Black Friday, Цагаан сар …).
 * Одоо байгаа гар хямдралыг (Хямдрал → Бараагаар) ДАРАХГҮЙ: хоёулаа байвал
 * хэрэглэгч хамгийн хямдыг нь төлнө, арга хэмжээ дуусахад бүгд өөрөө буцна.
 */
export function SaleEventAdmin({
  rows,
  products,
}: {
  rows: SaleEventAdminRow[];
  products: SaleEventProduct[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Төлөв цагаас хамаарна — серверийн рендерт биш, хөтөч дээр тооцно.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => setNow(Date.now()), []);

  async function stop(e: SaleEventAdminRow, phase: SaleEventPhase) {
    const ok = await confirm({
      title: `«${e.name}»-г зогсоох уу?`,
      description:
        phase === "live"
          ? "Үнэ яг одоо үндсэн (эсвэл өмнөх гар хямдрал) руугаа буцна. Арга хэмжээ түүхэнд үлдэнэ."
          : "Нийтлэлээс буцаж ноорог болно. Дэлгүүрт юу ч өөрчлөгдөхгүй.",
      confirmLabel: "Зогсоох",
      destructive: phase === "live",
    });
    if (!ok) return;
    setBusyId(e.id);
    try {
      const done = await mutateJson(
        `/api/admin/sale-events/${e.id}`,
        "PATCH",
        { action: "stop" },
        "Зогсоож чадсангүй",
      );
      if (!done) return;
      toast.success(`«${e.name}» зогслоо.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(e: SaleEventAdminRow) {
    const ok = await confirm({
      title: `«${e.name}»-г устгах уу?`,
      description: "Ноорог бүрэн устгагдана.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(e.id);
    try {
      const done = await mutateJson(
        `/api/admin/sale-events/${e.id}`,
        "DELETE",
        {},
        "Устгасангүй",
      );
      if (!done) return;
      toast.success("Ноорог устлаа.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Арга хэмжээ"
        count={rows.length}
        description="Black Friday, Цагаан сар, Наадам г.м. нэртэй, хугацаатай хямдрал. Хугацаа эхлэхэд үнэ буурч, каталогт шүүлтүүр гарна; дуусахад бүгд өөрөө буцна. Одоо байгаа хямдралыг дарахгүй — хоёулаа байвал хамгийн хямд нь."
        actions={
          rows.length > 0 && (
            <Button size="sm" onClick={() => setEditing({ mode: "new" })}>
              <Plus className="size-4" />
              Арга хэмжээ үүсгэх
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Tag}
          surface="card"
          title="Арга хэмжээ хараахан алга"
          description="Жишээ нь: Black Friday, 11/23–11/30, сонгосон усанд 20–30%. Бараа, хэмжээ бүрт өөр хувь өгч болно."
          action={
            <Button size="sm" onClick={() => setEditing({ mode: "new" })}>
              <Plus className="size-4" />
              Арга хэмжээ үүсгэх
            </Button>
          }
        />
      ) : (
        <ul role="list" className="space-y-3">
          {rows.map((e) => {
            const phase = now == null ? null : saleEventPhase(e, now);
            return (
              <li key={e.id}>
                <EventCard
                  event={e}
                  phase={phase}
                  busy={busyId === e.id}
                  onEdit={() => setEditing({ mode: "edit", row: e })}
                  onCopy={() => setEditing({ mode: "copy", row: e })}
                  onStop={() => phase && stop(e, phase)}
                  onRemove={() => remove(e)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <EventForm
        editing={editing}
        products={products}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function pctRange(e: SaleEventAdminRow): string {
  const all = e.items.flatMap((i) => Object.values(i.pcts));
  if (!all.length) return "Хувьгүй";
  const min = Math.min(...all);
  const max = Math.max(...all);
  return min === max ? `−${max}%` : `−${min}–${max}%`;
}

function EventCard({
  event: e,
  phase,
  busy,
  onEdit,
  onCopy,
  onStop,
  onRemove,
}: {
  event: SaleEventAdminRow;
  phase: SaleEventPhase | null;
  busy: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onStop: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className={cn(phase === "ended" && "bg-card/60")}>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg font-semibold wrap-break-word">
              {e.name}
            </h2>
            {phase && (
              <Badge variant={PHASE_BADGE[phase]}>
                {SALE_EVENT_PHASE_LABEL[phase]}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarRange className="size-3.5" />
              {formatEventPeriod(e.startsAt, e.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="size-3.5" />
              {e.items.length} бараа · {pctRange(e)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Tag className="size-3.5" />
              {e.badgeLabel ?? "Хямдрал"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {(phase === "live" || phase === "scheduled") && (
            <Button asChild variant="ghost" size="icon">
              <a
                href={`/catalog?event=${e.slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`«${e.name}»-г дэлгүүрт харах`}
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={`«${e.name}»-г засах`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopy}
            aria-label={`«${e.name}»-г хуулж шинэ ноорог үүсгэх`}
          >
            <Copy className="size-4" />
          </Button>
          {(phase === "live" || phase === "scheduled") && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onStop}
            >
              <Square className="size-4" />
              Зогсоох
            </Button>
          )}
          {phase === "draft" && (
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              onClick={onRemove}
              aria-label={`«${e.name}»-г устгах`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Маягт ───────────────────────────────────────────────────────────────

type Editing =
  | { mode: "new" }
  | { mode: "edit"; row: SaleEventAdminRow }
  | { mode: "copy"; row: SaleEventAdminRow };

const FORM_ID = "sale-event-form";

/** Бичиж байх үеийн утга — хувь мөр хэвээр (хоосон = хувьгүй). */
interface Draft {
  name: string;
  slug: string;
  /** Админ slug-ийг гараар өөрчилсөн бол нэрээс дахин үүсгэхгүй. */
  slugTouched: boolean;
  badgeLabel: string;
  headline: string;
  description: string;
  startsOn: string;
  endsOn: string;
  showCountdown: boolean;
  items: { productId: string; pcts: Record<number, string> }[];
}

function toDraft(editing: Editing): Draft {
  if (editing.mode === "new") {
    return {
      name: "",
      slug: "",
      slugTouched: false,
      badgeLabel: "",
      headline: "",
      description: "",
      startsOn: "",
      endsOn: "",
      showCountdown: true,
      items: [],
    };
  }
  const r = editing.row;
  const copy = editing.mode === "copy";
  return {
    name: r.name,
    slug: r.slug,
    slugTouched: true,
    badgeLabel: r.badgeLabel ?? "",
    headline: r.headline ?? "",
    description: r.description ?? "",
    // Хуулахад огноо хоосон (Цагаан сар жил бүр өөр өдөр, plan §9.3).
    startsOn: copy ? "" : isoToDay(r.startsAt),
    endsOn: copy ? "" : isoEndToDay(r.endsAt),
    showCountdown: r.showCountdown,
    items: r.items.map((i) => ({
      productId: i.productId,
      pcts: Object.fromEntries(
        Object.entries(i.pcts).map(([ml, pct]) => [Number(ml), String(pct)]),
      ),
    })),
  };
}

function toInput(d: Draft, isActive: boolean): unknown {
  return {
    name: d.name,
    slug: d.slug,
    badgeLabel: d.badgeLabel,
    headline: d.headline,
    description: d.description,
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    isActive,
    showCountdown: d.showCountdown,
    items: d.items.map((i) => ({
      productId: i.productId,
      pcts: Object.fromEntries(
        Object.entries(i.pcts)
          .filter(([, v]) => v.trim() !== "")
          // Хоосон биш бол тоо — буруу утгыг Zod барина (чимээгүй алгасахгүй).
          .map(([ml, v]) => [ml, Number(v)]),
      ),
    })),
  };
}

function EventForm({
  editing,
  products,
  onClose,
  onSaved,
}: {
  editing: Editing | null;
  products: SaleEventProduct[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [initial, setInitial] = React.useState<string>("");
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof SaleEventInput, string>>
  >({});
  const [conflicts, setConflicts] = React.useState<OverlapConflict[]>([]);
  const [busy, setBusy] = React.useState<"draft" | "publish" | null>(null);

  React.useEffect(() => {
    if (!editing) return;
    const next = toDraft(editing);
    setDraft(next);
    setInitial(JSON.stringify(next));
    setErrors({});
    setConflicts([]);
  }, [editing]);

  const isEdit = editing?.mode === "edit";
  const row = editing && editing.mode !== "new" ? editing.row : null;
  const phase = isEdit && row ? saleEventPhase(row) : null;
  const published = isEdit && row?.isActive === true;
  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setName(name: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            name,
            slug: d.slugTouched ? d.slug : slugify(name).slice(0, L.slugMax),
          }
        : d,
    );
    setErrors((e) => ({ ...e, name: undefined, slug: undefined }));
  }

  async function save(isActive: boolean) {
    if (!draft || !editing) return;
    const parsed = saleEventInputSchema.safeParse(toInput(draft, isActive));
    if (!parsed.success) {
      setErrors(saleEventFieldErrors(parsed.error));
      toast.error(parsed.error.issues[0]?.message ?? "Маягтаа шалгана уу.");
      return;
    }
    // Явж буй арга хэмжээг засах нь дэлгүүрт шууд нөлөөлнө (plan §9.1).
    if (phase === "live") {
      const ok = await confirm({
        title: "Одоо дэлгүүрт шууд нөлөөлнө",
        description: isActive
          ? "Явж буй арга хэмжээний үнэ, бараа, текст хадгалмагц дэлгүүрт солигдоно."
          : "Ноорог болговол хямдрал яг одоо зогсож, үнэ буцна.",
        confirmLabel: "Хадгалах",
      });
      if (!ok) return;
    }
    setBusy(isActive ? "publish" : "draft");
    try {
      const res = await adminFetch<{ conflicts?: OverlapConflict[] }>(
        isEdit && row
          ? `/api/admin/sale-events/${row.id}`
          : "/api/admin/sale-events",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!res.ok) {
        setConflicts(res.data?.conflicts ?? []);
        toast.error(res.error, "Хадгалагдсангүй");
        return;
      }
      toast.success(
        isActive ? "Арга хэмжээ нийтлэгдлээ." : "Ноорог хадгалагдлаа.",
      );
      onSaved();
    } finally {
      setBusy(null);
    }
  }

  const dirty = draft !== null && JSON.stringify(draft) !== initial;
  const conflictIds = new Set(conflicts.map((c) => c.productId));

  return (
    <FormDrawer
      open={editing !== null}
      dirty={dirty}
      onClose={onClose}
      wide
      title={
        editing?.mode === "edit"
          ? "Арга хэмжээ засах"
          : editing?.mode === "copy"
            ? "Хуулж шинэ арга хэмжээ"
            : "Арга хэмжээ үүсгэх"
      }
      description="Ноорог дэлгүүрт харагдахгүй. Нийтэлсний дараа эхлэх өдрийн 00:00:00-оос дуусах өдрийн 23:59:59 хүртэл (УБ) хүчинтэй."
      discardDescription="Бөглөсөн мэдээлэл тань хадгалагдахгүй."
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
      {confirmDialog}
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
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Үндсэн</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Нэр"
                hint="Каталогийн шүүлтүүрийн chip-д харагдана."
                error={errors.name}
              >
                <Input
                  value={draft.name}
                  maxLength={L.name}
                  placeholder="Black Friday"
                  className={fieldErrorClass(errors.name)}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field
                label="URL-д орох текст (slug)"
                hint={`vonscent.mn/sale/${draft.slug || "…"} — латин жижиг үсэг, тоо, зураас`}
                error={errors.slug}
              >
                <Input
                  value={draft.slug}
                  maxLength={L.slugMax}
                  placeholder="black-friday"
                  className={fieldErrorClass(errors.slug)}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            slug: e.target.value.toLowerCase(),
                            slugTouched: true,
                          }
                        : d,
                    )
                  }
                />
              </Field>
              <Field label="Эхлэх өдөр" hint="00:00:00-оос" error={errors.startsOn}>
                <DatePicker
                  value={draft.startsOn}
                  placeholder="Огноо сонгох"
                  clearable={false}
                  onChange={(v) => set("startsOn", v)}
                />
              </Field>
              <Field
                label="Дуусах өдөр"
                hint="23:59:59 хүртэл"
                error={errors.endsOn}
              >
                <DatePicker
                  value={draft.endsOn}
                  placeholder="Огноо сонгох"
                  clearable={false}
                  min={draft.startsOn || ubToday()}
                  onChange={(v) => set("endsOn", v)}
                />
              </Field>
              <Field
                label="Картын тэмдэг (Badge text)"
                hint="Барааны картын буланд. Хоосон бол «Хямдрал»."
                error={errors.badgeLabel}
              >
                <Input
                  value={draft.badgeLabel}
                  maxLength={L.badgeLabel}
                  placeholder="Black Friday"
                  onChange={(e) => set("badgeLabel", e.target.value)}
                />
              </Field>
              <Field
                label="Каталогийн гарчиг"
                hint="Хоосон бол нэр."
                error={errors.headline}
              >
                <Input
                  value={draft.headline}
                  maxLength={L.headline}
                  placeholder="Black Friday — 30% хүртэл"
                  onChange={(e) => set("headline", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Каталогийн тайлбар"
              hint={`${draft.description.length}/${L.description}`}
              error={errors.description}
            >
              <textarea
                rows={2}
                maxLength={L.description}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={draft.showCountdown}
                onCheckedChange={(v) => set("showCountdown", v === true)}
              />
              Дуусах тоолуур харуулах
              <span className="text-muted-foreground text-xs">
                («Дуусахад 2 өдөр 4 цаг»)
              </span>
            </label>
          </section>

          <ItemsSection
            draft={draft}
            products={products}
            byId={byId}
            conflictIds={conflictIds}
            error={errors.items}
            onChange={(items) => {
              set("items", items);
              setConflicts([]);
            }}
          />
          {conflicts.length > 0 && (
            <p className="text-destructive text-sm" role="alert">
              Улаанаар тэмдэглэсэн бараа хугацаа давхцсан өөр арга хэмжээнд
              байна — хасах эсвэл хугацааг өөрчилнө үү.
            </p>
          )}
        </form>
      )}
    </FormDrawer>
  );
}

/**
 * Бараа + хувь (plan §9.1-2): одоогийн «Хямдрал» хуудасны урсгалтай ижил —
 * бараагаа шүүж сонгоод хэмжээ бүрт хувь өгч «Хэрэглэх»; өөр бүлэгт өөр хувь
 * өгч давтана. Доорх хүснэгтэд бараа бүрийн хувийг шууд засна.
 */
function ItemsSection({
  draft,
  products,
  byId,
  conflictIds,
  error,
  onChange,
}: {
  draft: Draft;
  products: SaleEventProduct[];
  byId: Map<string, SaleEventProduct>;
  conflictIds: Set<string>;
  error?: string;
  onChange: (items: Draft["items"]) => void;
}) {
  const [q, setQ] = React.useState("");
  const [gender, setGender] = React.useState<Gender | "all">("all");
  const [brand, setBrand] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pcts, setPcts] = React.useState<Record<number, string>>({});

  const brands = React.useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products],
  );
  const memberIds = new Set(draft.items.map((i) => i.productId));
  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (gender === "all" || p.gender === gender) &&
        (brand === "all" || p.brand === brand) &&
        (!term || `${p.brand} ${p.name}`.toLowerCase().includes(term)),
    );
  }, [products, q, gender, brand]);
  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allVisibleSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  /** Сонгосон бараануудыг нэмнэ / хувийг нь сольж бичнэ. */
  function apply(withPcts: boolean) {
    const filled = Object.fromEntries(
      Object.entries(pcts).filter(([, v]) => v.trim() !== ""),
    ) as Record<number, string>;
    const items = [...draft.items];
    for (const id of selected) {
      const at = items.findIndex((i) => i.productId === id);
      const next = { productId: id, pcts: withPcts ? { ...filled } : {} };
      if (at >= 0) items[at] = next;
      else items.push(next);
    }
    onChange(items);
    setSelected(new Set());
  }

  function setItemPct(productId: string, ml: number, value: string) {
    onChange(
      draft.items.map((i) =>
        i.productId === productId
          ? { ...i, pcts: { ...i.pcts, [ml]: value } }
          : i,
      ),
    );
  }

  const pctValues = Object.values(pcts).filter((v) => v.trim() !== "");
  const pctError = pctValues.some((v) => {
    const n = Number(v);
    return !Number.isInteger(n) || n < 1 || n > SALE_EVENT_MAX_PCT;
  })
    ? `Хувь 1–${SALE_EVENT_MAX_PCT} бүхэл тоо.`
    : null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Бараа ба хувь</h3>
        <p className="text-muted-foreground text-xs">
          Бараагаа сонгоод хэмжээ бүрт хувь өгч «Хэрэглэх». Өөр бүлэгт өөр хувь
          өгч давтана. Хоосон хэмжээ хямдрахгүй. Хувь нь үндсэн үнээс, 100₮-д
          дугуйрна.
        </p>
      </div>

      {/* ── 1. Сонгох ──────────────────────────────────────────────── */}
      <div className="bg-secondary/60 space-y-3 rounded-lg p-3">
        <div className="flex flex-wrap items-end gap-2">
          {ML_SIZES.map((ml) => (
            <label key={ml} className="space-y-1 text-xs">
              <span className="text-muted-foreground block">{ml}ml (%)</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={SALE_EVENT_MAX_PCT}
                className="h-11 w-20 md:h-9"
                placeholder="—"
                value={pcts[ml] ?? ""}
                onChange={(e) =>
                  setPcts((p) => ({ ...p, [ml]: e.target.value }))
                }
              />
            </label>
          ))}
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground block">Бүгдэд</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={SALE_EVENT_MAX_PCT}
              className="h-11 w-20 md:h-9"
              placeholder="%"
              onChange={(e) =>
                setPcts(
                  Object.fromEntries(
                    ML_SIZES.map((ml) => [ml, e.target.value]),
                  ),
                )
              }
            />
          </label>
        </div>
        {pctError && <p className="text-destructive text-xs">{pctError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={selected.size === 0 || pctValues.length === 0 || !!pctError}
            onClick={() => apply(true)}
          >
            Сонгосон {selected.size} бараанд хэрэглэх
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => apply(false)}
          >
            Хувьгүй нэмэх
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Брэнд / нэр"
              className="pl-9"
            />
          </div>
          <Select
            value={gender}
            onValueChange={(v) => setGender(v as Gender | "all")}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх хүйс</SelectItem>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {GENDER_LABEL[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх брэнд</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ul
          role="list"
          className="bg-card divide-border max-h-72 divide-y overflow-y-auto rounded-md"
        >
          <li className="flex items-center gap-3 px-3 py-2 text-xs">
            <Checkbox
              aria-label="Харагдаж буй бүх барааг сонгох"
              checked={allVisibleSelected}
              onCheckedChange={toggleAll}
            />
            <span className="text-muted-foreground">
              Бүгд ({visible.length}) · {selected.size} сонгосон
            </span>
          </li>
          {visible.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    {p.brand}
                  </span>
                </span>
                {memberIds.has(p.id) && (
                  <Badge variant="secondary" className="shrink-0">
                    Нэмсэн
                  </Badge>
                )}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* ── 2. Арга хэмжээний бараа ───────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium">
            Арга хэмжээнд ({draft.items.length})
          </h4>
          {draft.items.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
            >
              Бүгдийг хасах
            </Button>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {draft.items.length === 0 ? (
          <p className="text-muted-foreground bg-secondary/40 rounded-md p-4 text-center text-sm">
            Дээрээс бараа сонгож нэмнэ үү.
          </p>
        ) : (
          <ul role="list" className="space-y-2">
            {draft.items.map((item) => {
              const p = byId.get(item.productId);
              const conflict = conflictIds.has(item.productId);
              return (
                <li
                  key={item.productId}
                  className={cn(
                    "bg-card space-y-2 rounded-md p-3",
                    conflict && "ring-destructive ring-2",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">
                        {p?.name ?? "Нуусан / устгасан бараа"}
                      </span>{" "}
                      <span className="text-muted-foreground text-xs">
                        {p?.brand}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`${p?.name ?? "Бараа"}-г хасах`}
                      onClick={() =>
                        onChange(
                          draft.items.filter(
                            (i) => i.productId !== item.productId,
                          ),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ML_SIZES.filter((ml) => p?.prices[ml] != null).map(
                      (ml) => {
                        const base = p?.prices[ml] ?? 0;
                        const raw = item.pcts[ml] ?? "";
                        const n = Number(raw);
                        const valid =
                          raw.trim() !== "" &&
                          Number.isInteger(n) &&
                          n >= 1 &&
                          n <= SALE_EVENT_MAX_PCT;
                        return (
                          <label key={ml} className="space-y-1 text-xs">
                            <span className="text-muted-foreground flex items-center justify-between gap-1">
                              <span>{ml}ml</span>
                              <span className="tabular-nums">
                                {valid ? (
                                  <>
                                    <span className="line-through">
                                      {formatPrice(base)}
                                    </span>{" "}
                                    <span className="text-foreground font-medium">
                                      {formatPrice(bulkSalePrice(base, n))}
                                    </span>
                                  </>
                                ) : (
                                  formatPrice(base)
                                )}
                              </span>
                            </span>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={SALE_EVENT_MAX_PCT}
                              placeholder="—"
                              aria-label={`${p?.name ?? ""} ${ml}ml хувь`}
                              className={cn(
                                "h-11 md:h-9",
                                raw.trim() !== "" &&
                                  !valid &&
                                  "field-edge-error",
                              )}
                              value={raw}
                              onChange={(e) =>
                                setItemPct(item.productId, ml, e.target.value)
                              }
                            />
                          </label>
                        );
                      },
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
