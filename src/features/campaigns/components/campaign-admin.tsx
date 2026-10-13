"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  PartyPopper,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { fieldErrorClass } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingButton } from "@/components/shared/loading-button";
import { PageHeader } from "@/components/shared/page-header";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DatePicker } from "@/features/admin/components/date-picker";
import { FormDrawer } from "@/features/admin/components/form-drawer";
import { adminFetch, mutate, mutateJson } from "@/features/admin/lib/mutate";
import { CouponTicket } from "@/features/account/components/coupon-ticket";
import {
  campaignFieldErrors,
  campaignInputSchema,
  type CampaignInput,
} from "@/lib/validators/campaign";
import { formatPrice } from "@/lib/format";
import { ubToday } from "@/lib/time";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CampaignAdminRow } from "../api";
import {
  PHASE_LABEL,
  addDays,
  campaignPhase,
  couponEndsOn,
  formatDay,
  type CampaignPhase,
} from "../lib";

const PHASE_BADGE: Record<
  CampaignPhase,
  "new" | "secondary" | "outline" | "gold"
> = {
  live: "new",
  scheduled: "gold",
  ended: "secondary",
  off: "outline",
};

const TYPE_LABEL: Record<CampaignAdminRow["type"], string> = {
  signup_coupon: "Бүртгэлийн купон",
};

/**
 * Админ → Маркетинг → Кампанит ажил (0135).
 *
 * Нэг кампанит ажил = нэг карт: юу олгодог (купон), хэзээ (хугацаа), одоо
 * олгож байгаа эсэх (төлөв), үр дүн (хэдэн хүн авч, хэд нь ашигласан).
 * Олгосон купон нь кампанит ажлыг засахад өөрчлөгдөхгүй — тэр хэрэглэгчийн
 * «Миний купон»-д аль хэдийн байгаа.
 */
export function CampaignAdmin({ rows }: { rows: CampaignAdminRow[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = React.useState<CampaignAdminRow | "new" | null>(
    null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Серверийн рендерт өнөөдрийг тооцохгүй — UB өдөр хөтөч дээр тогтоно.
  const [today, setToday] = React.useState<string | null>(null);
  React.useEffect(() => setToday(ubToday()), []);

  async function toggle(c: CampaignAdminRow) {
    setBusyId(c.id);
    try {
      const ok = await mutateJson(
        `/api/admin/campaigns/${c.id}`,
        "PATCH",
        { isActive: !c.isActive },
        c.isActive ? "Унтраасангүй" : "Асаасангүй",
      );
      if (!ok) return;
      toast.success(
        c.isActive ? `«${c.name}» унтарлаа.` : `«${c.name}» асаалаа.`,
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: CampaignAdminRow) {
    const ok = await confirm({
      title: `«${c.name}»-г устгах уу?`,
      description: "Нэг ч купон олгоогүй тул бүрэн устгагдана.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    if (
      !(await mutate(
        `/api/admin/campaigns/${c.id}`,
        { method: "DELETE" },
        "Устгасангүй",
      ))
    )
      return;
    toast.success("Кампанит ажил устлаа.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Кампанит ажил"
        count={rows.length}
        description="Шинэ хэрэглэгчийг бэлгээр угтах урамшуулал. Хугацаанд нь бүртгүүлсэн хүн бүрт купон автоматаар очно."
        actions={
          rows.length > 0 && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Кампанит ажил үүсгэх
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          surface="card"
          title="Кампанит ажил хараахан алга"
          description="Жишээ нь: шинээр бүртгүүлсэн хүн бүрт 5,000₮-ийн купон. Хугацаа, дүн, доод захиалгыг та өөрөө тохируулна."
          action={
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Кампанит ажил үүсгэх
            </Button>
          }
        />
      ) : (
        <ul role="list" className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <CampaignCard
                campaign={c}
                today={today}
                busy={busyId === c.id}
                onToggle={() => toggle(c)}
                onEdit={() => setEditing(c)}
                onRemove={() => remove(c)}
              />
            </li>
          ))}
        </ul>
      )}

      <CampaignForm
        campaign={editing}
        today={today}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function CampaignCard({
  campaign: c,
  today,
  busy,
  onToggle,
  onEdit,
  onRemove,
}: {
  campaign: CampaignAdminRow;
  today: string | null;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const phase = today ? campaignPhase(c, today) : null;
  const usedPct =
    c.stats.issued > 0 ? Math.round((c.stats.used / c.stats.issued) * 100) : 0;

  return (
    <Card className={cn(phase === "off" && "bg-card/60")}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold">{c.name}</h2>
              {phase && (
                <Badge variant={PHASE_BADGE[phase]}>{PHASE_LABEL[phase]}</Badge>
              )}
              {phase === "scheduled" && (
                <span className="text-muted-foreground text-xs">
                  {formatDay(c.startsOn)}-нөөс олгож эхэлнэ
                </span>
              )}
            </div>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <UserPlus className="size-3.5" />
                {TYPE_LABEL[c.type]}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarRange className="size-3.5" />
                {formatDay(c.startsOn)} — {formatDay(c.endsOn)}
              </span>
            </p>
            {c.description && (
              <p className="text-muted-foreground pt-1 text-sm">
                {c.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant={c.isActive ? "outline" : "default"}
              size="sm"
              disabled={busy}
              onClick={onToggle}
            >
              {c.isActive ? (
                <>
                  <PowerOff className="size-4" /> Унтраах
                </>
              ) : (
                <>
                  <Power className="size-4" /> Асаах
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              aria-label={`«${c.name}»-г засах`}
            >
              <Pencil className="size-4" />
            </Button>
            {c.stats.customers === 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                aria-label={`«${c.name}»-г устгах`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <dl className="bg-secondary/60 grid grid-cols-2 gap-px overflow-hidden rounded-lg text-sm sm:grid-cols-4">
          <Term label="Купон">{formatPrice(c.couponValue)}</Term>
          <Term label="Доод захиалга">
            {c.minSubtotal > 0 ? formatPrice(c.minSubtotal) : "Хязгааргүй"}
          </Term>
          <Term label="Хүчинтэй">{c.couponValidDays} хоног</Term>
          <Term label="Үр дүн">
            {c.stats.customers.toLocaleString("mn-MN")} хүн
            <span className="text-muted-foreground">
              {" "}
              · {c.stats.used.toLocaleString("mn-MN")} ашигласан
              {c.stats.issued > 0 && ` (${usedPct}%)`}
            </span>
          </Term>
        </dl>
      </CardContent>
    </Card>
  );
}

function Term({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{children}</dd>
    </div>
  );
}

// ── Маягт ───────────────────────────────────────────────────────────────

const FORM_ID = "campaign-form";

/** Бичиж байх үеийн утга — тоонууд мөр хэвээр. */
interface Draft {
  name: string;
  description: string;
  startsOn: string;
  endsOn: string;
  couponValue: string;
  minSubtotal: string;
  couponValidDays: string;
  isActive: boolean;
}

function emptyDraft(today: string): Draft {
  return {
    name: "Бүртгэлийн бэлэг",
    description: "",
    startsOn: today,
    endsOn: addDays(today, 30),
    couponValue: "5000",
    minSubtotal: "0",
    couponValidDays: "30",
    isActive: false,
  };
}

function toDraft(c: CampaignAdminRow): Draft {
  return {
    name: c.name,
    description: c.description,
    startsOn: c.startsOn,
    endsOn: c.endsOn,
    couponValue: String(c.couponValue),
    minSubtotal: String(c.minSubtotal),
    couponValidDays: String(c.couponValidDays),
    isActive: c.isActive,
  };
}

/** Хоосон талбар → NaN, тэгвэл Zod «оруулна уу» гэнэ (0 гэж чимээгүй хадгалахгүй). */
const toInt = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

function CampaignForm({
  campaign,
  today,
  onClose,
  onSaved,
}: {
  campaign: CampaignAdminRow | "new" | null;
  today: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = campaign !== null;
  const isNew = campaign === "new";
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [initial, setInitial] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof CampaignInput, string>>
  >({});
  const [busy, setBusy] = React.useState(false);

  // Нээх бүрд шинэ маягт: засах бол тухайн мөрөөс, шинэ бол анхдагчаар.
  React.useEffect(() => {
    if (!campaign || !today) return;
    const next = campaign === "new" ? emptyDraft(today) : toDraft(campaign);
    setDraft(next);
    setInitial(next);
    setErrors({});
  }, [campaign, today]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !campaign) return;
    const parsed = campaignInputSchema.safeParse({
      type: "signup_coupon",
      name: draft.name,
      description: draft.description,
      isActive: draft.isActive,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      couponValue: toInt(draft.couponValue),
      minSubtotal: toInt(draft.minSubtotal),
      couponValidDays: toInt(draft.couponValidDays),
    });
    if (!parsed.success) {
      setErrors(campaignFieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      const res = await adminFetch(
        isNew ? "/api/admin/campaigns" : `/api/admin/campaigns/${campaign.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!res.ok) {
        toast.error(res.error, "Хадгалагдсангүй");
        return;
      }
      toast.success(isNew ? "Кампанит ажил үүслээ." : "Өөрчлөлт хадгалагдлаа.");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(initial);
  const value = Number(draft?.couponValue) || 0;
  const minSubtotal = Number(draft?.minSubtotal) || 0;
  const validDays = Number(draft?.couponValidDays) || 0;

  return (
    <FormDrawer
      open={open}
      dirty={dirty}
      onClose={onClose}
      title={isNew ? "Кампанит ажил үүсгэх" : "Кампанит ажил засах"}
      description="Хугацаанд нь шинээр бүртгүүлсэн хэрэглэгч бүрт купон автоматаар үүснэ."
      discardDescription="Бөглөсөн мэдээлэл тань хадгалагдахгүй."
      footer={
        <LoadingButton type="submit" form={FORM_ID} loading={busy}>
          {isNew ? "Үүсгэх" : "Хадгалах"}
        </LoadingButton>
      }
    >
      {draft && (
        <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-6">
          {/* Урьдчилсан харагдац — хэрэглэгчийн «Миний купон»-д яг ингэж
              харагдана. Тоо өөрчлөхөд шууд шинэчлэгдэнэ. */}
          <div className="space-y-2">
            <CouponTicket type="fixed" value={value} code="VN-XXXXXX" onCard>
              <p className="truncate">
                {today && validDays > 0
                  ? `Өнөөдөр авбал ${formatDay(couponEndsOn(today, validDays))} хүртэл`
                  : "Хүчинтэй хугацаа"}
              </p>
              {minSubtotal > 0 && (
                <p className="truncate">
                  {formatPrice(minSubtotal)}-өөс дээш захиалгад
                </p>
              )}
            </CouponTicket>
            <p className="text-muted-foreground text-center text-xs">
              Хэрэглэгч бүр нэг купон авна · нэг л удаа ашиглагдана
            </p>
          </div>

          <section className="space-y-4">
            <Field label="Нэр" error={errors.name}>
              <Input
                value={draft.name}
                maxLength={120}
                className={fieldErrorClass(errors.name)}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field
              label="Тайлбар"
              hint="Зөвхөн админд харагдана."
              error={errors.description}
            >
              <textarea
                rows={2}
                maxLength={500}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Хугацаа</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Эхлэх өдөр"
                hint="00:00:00-оос"
                error={errors.startsOn}
              >
                <DatePicker
                  value={draft.startsOn}
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
                  clearable={false}
                  onChange={(v) => set("endsOn", v)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Купон</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Купоны дүн (₮)" error={errors.couponValue}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  value={draft.couponValue}
                  className={fieldErrorClass(errors.couponValue)}
                  onChange={(e) => set("couponValue", e.target.value)}
                />
              </Field>
              <Field
                label="Доод захиалга (₮)"
                hint="0 бол ямар ч дүнтэй захиалгад."
                error={errors.minSubtotal}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={draft.minSubtotal}
                  className={fieldErrorClass(errors.minSubtotal)}
                  onChange={(e) => set("minSubtotal", e.target.value)}
                />
              </Field>
              <Field
                label="Хүчинтэй хугацаа (хоног)"
                hint="Олгосон өдрийг оролцуулан, сүүлийн өдрийн 23:59:59 хүртэл."
                error={errors.couponValidDays}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={draft.couponValidDays}
                  className={fieldErrorClass(errors.couponValidDays)}
                  onChange={(e) => set("couponValidDays", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <label className="bg-secondary/60 flex items-start gap-3 rounded-lg p-3 text-sm">
            <Checkbox
              checked={draft.isActive}
              onCheckedChange={(v) => set("isActive", v === true)}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block font-medium">Идэвхтэй</span>
              <span className="text-muted-foreground block text-xs">
                Асаалттай бөгөөд хугацаандаа байх үед л купон олгоно. Ижил
                хугацаанд өөр идэвхтэй кампанит ажил байж болохгүй.
              </span>
            </span>
          </label>
        </form>
      )}
    </FormDrawer>
  );
}
