"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  Send,
  Undo2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { IconUpload } from "@/features/admin/components/icon-upload";
import { PickerPopup } from "@/features/admin/components/customer-picker";
import { adminFetch } from "@/features/admin/lib/mutate";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_KINDS,
  BROADCAST_KIND_LABEL,
  BROADCAST_TITLE_MAX,
  broadcastFieldErrors,
  broadcastInputSchema,
  type BroadcastInput,
  type BroadcastKind,
} from "@/lib/validators/notification";
import { ubDayFromNow } from "@/lib/time";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  BROADCAST_PHASE_LABEL,
  SCHEDULE_TIMES,
  broadcastPhase,
  formatUbDateTime,
  isoToUbParts,
  readPercent,
  ubDateTimeToIso,
  type BroadcastPhase,
} from "../broadcast-lib";
import type {
  BroadcastAdminRow,
  BroadcastLinkTarget,
  BroadcastPrefill,
} from "../broadcast-types";
import type { AppNotification } from "../types";
import { NotificationItem, NotificationThumb } from "./notification-item";
import { NotificationToast } from "./notification-toast";

const PHASE_BADGE: Record<
  BroadcastPhase,
  "new" | "secondary" | "outline" | "gold" | "sale"
> = {
  draft: "outline",
  scheduled: "gold",
  overdue: "sale",
  sent: "new",
  cancelled: "secondary",
};

const fmt = (n: number) => n.toLocaleString("mn-MN");

/**
 * Админ → Маркетинг → Мэдэгдэл илгээх (0138, туг `notifications`).
 *
 * Нэг мэдэгдэл = нэг карт: юу (гарчиг, текст, холбоос), хэзээ (төлөв,
 * хуваарь), үр дүн (хэдэн хүнд очиж, хэд нь уншсан). Илгээсний дараа засах
 * боломжгүй — зөвхөн буцааж татна (хэрэглэгчдийн мөр устана).
 */
export function BroadcastAdmin({
  rows,
  audience,
  prefill,
}: {
  rows: BroadcastAdminRow[];
  /** Нийт профайл — «N хэрэглэгчид илгээх үү?». */
  audience: number;
  prefill: BroadcastPrefill | null;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = React.useState<
    BroadcastAdminRow | BroadcastPrefill | "new" | null
  >(prefill);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function sendNow(b: BroadcastAdminRow) {
    const ok = await confirm({
      title: `${fmt(audience)} хэрэглэгчид одоо илгээх үү?`,
      description:
        "Илгээсний дараа засах боломжгүй — шаардлагатай бол буцааж татна.",
      confirmLabel: "Илгээх",
    });
    if (!ok) return;
    setBusyId(b.id);
    try {
      const res = await adminFetch<{ recipients?: number }>(
        `/api/admin/broadcasts/${b.id}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishAt: null }),
        },
      );
      if (!res.ok) {
        toast.error(res.error, "Илгээгдсэнгүй");
        return;
      }
      toast.success(`${fmt(res.data.recipients ?? 0)} хэрэглэгчид илгээлээ.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function sendTest(b: { id: string }) {
    setBusyId(b.id);
    try {
      const res = await adminFetch(`/api/admin/broadcasts/${b.id}/test`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error(res.error, "Туршилт илгээгдсэнгүй");
        return;
      }
      toast.success("Танд туршилтын мэдэгдэл илгээлээ. Хонхоо шалгаарай.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(b: BroadcastAdminRow) {
    const sent = b.status === "sent";
    const ok = await confirm({
      title: sent ? "Мэдэгдлийг буцааж татах уу?" : "Хуваарийг цуцлах уу?",
      description: sent
        ? `${fmt(b.recipientCount)} хэрэглэгчийн мэдэгдлийн жагсаалтаас устгана. Аль хэдийн уншсан хүмүүс үүнийг харсан байх болно.`
        : "Энэ мэдэгдэл илгээгдэхгүй. Түүхэнд «Буцаасан» гэж үлдэнэ.",
      confirmLabel: sent ? "Буцааж татах" : "Цуцлах",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(b.id);
    try {
      const res = await adminFetch(`/api/admin/broadcasts/${b.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error(res.error, "Буцаагдсангүй");
        return;
      }
      toast.success(sent ? "Мэдэгдлийг буцааж татлаа." : "Хуваарь цуцлагдлаа.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Мэдэгдэл илгээх"
        count={rows.length}
        description={`Шинэ бараа, хямдрал, мэдээг бүх хэрэглэгчийн хонх руу илгээнэ. Одоогоор ${fmt(audience)} хэрэглэгч хүлээн авна.`}
        actions={
          rows.length > 0 && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Шинэ мэдэгдэл
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          surface="card"
          title="Илгээсэн мэдэгдэл алга"
          description="Жишээ нь: «Шинэ үнэртэн ирлээ» эсвэл «Энэ амралтын өдөр бүх 10ml 15% хямд». Эхлээд өөртөө туршиж илгээж болно."
          action={
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Шинэ мэдэгдэл
            </Button>
          }
        />
      ) : (
        <ul role="list" className="space-y-3">
          {rows.map((b) => (
            <li key={b.id}>
              <BroadcastCard
                broadcast={b}
                busy={busyId === b.id}
                onEdit={() => setEditing(b)}
                onSend={() => sendNow(b)}
                onTest={() => sendTest(b)}
                onCancel={() => cancel(b)}
              />
            </li>
          ))}
        </ul>
      )}

      <BroadcastForm
        broadcast={editing}
        audience={audience}
        confirm={confirm}
        onTest={sendTest}
        onClose={() => {
          setEditing(null);
          // `?product=` урьдчилан бөглөлтийг дахин нээгдэхээс сэргийлнэ.
          if (prefill) router.replace("/admin/broadcasts");
        }}
        onDone={() => {
          setEditing(null);
          if (prefill) router.replace("/admin/broadcasts");
          router.refresh();
        }}
      />
    </div>
  );
}

function BroadcastCard({
  broadcast: b,
  busy,
  onEdit,
  onSend,
  onTest,
  onCancel,
}: {
  broadcast: BroadcastAdminRow;
  busy: boolean;
  onEdit: () => void;
  onSend: () => void;
  onTest: () => void;
  onCancel: () => void;
}) {
  const phase = broadcastPhase(b);
  const editable = b.status === "draft" || b.status === "scheduled";

  return (
    <Card className={cn(phase === "cancelled" && "bg-card/60")}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <NotificationThumb notification={b} />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{b.title}</h2>
                <Badge variant={PHASE_BADGE[phase]}>
                  {BROADCAST_PHASE_LABEL[phase]}
                </Badge>
              </div>
              {b.body && (
                <p className="text-muted-foreground text-sm">{b.body}</p>
              )}
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>{BROADCAST_KIND_LABEL[b.kind]}</span>
                {b.url && <span className="truncate">{b.url}</span>}
                {(b.status === "scheduled" || b.sentAt) && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <CalendarClock className="size-3.5" />
                    {formatUbDateTime(b.sentAt ?? b.publishAt)}
                  </span>
                )}
              </p>
              {phase === "overdue" && (
                <p className="text-destructive text-xs">
                  Хуваарьт цагаас 24 цаг өнгөрсөн тул автоматаар илгээгдээгүй.
                  Одоо илгээх, хуваарийг шинэчлэх эсвэл цуцлах уу?
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {busy && (
              <Loader2
                className="text-muted-foreground size-4 animate-spin"
                aria-label="Түр хүлээнэ үү"
              />
            )}
            {editable && (
              <>
                <Button size="sm" disabled={busy} onClick={onSend}>
                  <Send className="size-4" /> Одоо илгээх
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={onTest}
                  aria-label="Надад туршиж илгээх"
                  title="Надад туршиж илгээх"
                >
                  <FlaskConical className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={onEdit}
                  aria-label={`«${b.title}»-г засах`}
                >
                  <Pencil className="size-4" />
                </Button>
              </>
            )}
            {(b.status === "sent" || b.status === "scheduled") && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={onCancel}
                className="text-muted-foreground hover:text-destructive"
              >
                <Undo2 className="size-4" />
                {b.status === "sent" ? "Буцааж татах" : "Цуцлах"}
              </Button>
            )}
          </div>
        </div>

        {b.status === "sent" && (
          <p className="bg-secondary/60 flex flex-wrap items-center gap-x-2 rounded-lg px-3 py-2 text-sm tabular-nums">
            <Users className="text-muted-foreground size-4" />
            {fmt(b.recipientCount)} хэрэглэгчид очсон
            <span className="text-muted-foreground">
              · {fmt(b.readCount)} уншсан (
              {readPercent(b.readCount, b.recipientCount)}%)
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Маягт ───────────────────────────────────────────────────────────────

const FORM_ID = "broadcast-form";

interface Draft {
  kind: BroadcastKind;
  title: string;
  body: string;
  url: string;
  imageUrl: string | null;
  when: "now" | "scheduled";
  day: string;
  time: string;
}

function toDraft(source: BroadcastAdminRow | BroadcastPrefill | "new"): Draft {
  const tomorrow = { day: ubDayFromNow(1), time: "10:00" };
  if (source === "new") {
    return {
      kind: "announcement",
      title: "",
      body: "",
      url: "",
      imageUrl: null,
      when: "now",
      ...tomorrow,
    };
  }
  const scheduled = "status" in source && source.status === "scheduled";
  return {
    kind: source.kind,
    title: source.title,
    body: source.body,
    url: source.url,
    imageUrl: source.imageUrl,
    when: scheduled ? "scheduled" : "now",
    ...(scheduled ? isoToUbParts(source.publishAt) : tomorrow),
  };
}

function BroadcastForm({
  broadcast,
  audience,
  confirm,
  onTest,
  onClose,
  onDone,
}: {
  broadcast: BroadcastAdminRow | BroadcastPrefill | "new" | null;
  audience: number;
  confirm: ReturnType<typeof useConfirm>[0];
  onTest: (b: { id: string }) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = broadcast !== null;
  const existingId =
    broadcast && broadcast !== "new" && "id" in broadcast ? broadcast.id : null;
  // Туршиж илгээхэд ноорог хадгалагдана — дараагийн хадгалалт PUT болно.
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const id = existingId ?? savedId;

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [initial, setInitial] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof BroadcastInput | "schedule", string>>
  >({});
  const [busy, setBusy] = React.useState<"save" | "send" | "test" | null>(null);

  React.useEffect(() => {
    if (!broadcast) return;
    const next = toDraft(broadcast);
    setDraft(next);
    setInitial(next);
    setErrors({});
    setSavedId(null);
  }, [broadcast]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({
      ...e,
      [key]: undefined,
      ...(key === "day" || key === "time" || key === "when"
        ? { schedule: undefined }
        : {}),
    }));
  }

  /** Хадгалаад id буцаана; алдаатай бол null. */
  async function save(): Promise<string | null> {
    if (!draft) return null;
    const parsed = broadcastInputSchema.safeParse({
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      url: draft.url,
      imageUrl: draft.imageUrl,
    });
    if (!parsed.success) {
      setErrors(broadcastFieldErrors(parsed.error));
      return null;
    }
    const res = await adminFetch<{ id?: string }>(
      id ? `/api/admin/broadcasts/${id}` : "/api/admin/broadcasts",
      {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      },
    );
    if (!res.ok) {
      toast.error(res.error, "Хадгалагдсангүй");
      return null;
    }
    const saved = id ?? res.data.id ?? null;
    if (saved && !id) setSavedId(saved);
    return saved;
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    try {
      if (await save()) {
        toast.success("Ноорог хадгалагдлаа.");
        onDone();
      }
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const saved = await save();
      if (saved) {
        await onTest({ id: saved });
        setInitial(draft);
      }
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!draft) return;
    let publishAt: string | null = null;
    if (draft.when === "scheduled") {
      publishAt = ubDateTimeToIso(draft.day, draft.time);
      if (Date.parse(publishAt) <= Date.now()) {
        setErrors((e) => ({ ...e, schedule: "Ирээдүйн цаг сонгоно уу." }));
        return;
      }
    }
    const ok = await confirm(
      publishAt
        ? {
            title: `${formatUbDateTime(publishAt)}-д илгээх үү?`,
            description: `Тэр үед бүртгэлтэй бүх хэрэглэгчид (одоогоор ${fmt(audience)}) очно. Тэр хүртэл засаж эсвэл цуцалж болно.`,
            confirmLabel: "Хуваарьлах",
          }
        : {
            title: `${fmt(audience)} хэрэглэгчид одоо илгээх үү?`,
            description:
              "Илгээсний дараа засах боломжгүй — шаардлагатай бол буцааж татна.",
            confirmLabel: "Илгээх",
          },
    );
    if (!ok) return;
    setBusy("send");
    try {
      const saved = await save();
      if (!saved) return;
      const res = await adminFetch<{ recipients?: number }>(
        `/api/admin/broadcasts/${saved}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishAt }),
        },
      );
      if (!res.ok) {
        toast.error(res.error, "Илгээгдсэнгүй");
        return;
      }
      toast.success(
        publishAt
          ? `${formatUbDateTime(publishAt)}-д илгээгдэнэ.`
          : `${fmt(res.data.recipients ?? 0)} хэрэглэгчид илгээлээ.`,
      );
      onDone();
    } finally {
      setBusy(null);
    }
  }

  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(initial);
  const isNew = !existingId;

  const preview: AppNotification | null = draft && {
    id: "preview",
    kind: draft.kind,
    title: draft.title.trim() || "Гарчиг энд харагдана",
    body: draft.body.trim() || null,
    url: null,
    imageUrl: draft.imageUrl,
    read: false,
    visibleAt: new Date().toISOString(),
  };

  return (
    <FormDrawer
      open={open}
      dirty={dirty}
      onClose={onClose}
      title={isNew ? "Шинэ мэдэгдэл" : "Мэдэгдэл засах"}
      description="Бүртгэлтэй бүх хэрэглэгчийн хонх руу очно. Илгээхээс өмнө өөртөө туршиж үзээрэй."
      discardDescription="Бичсэн мэдэгдэл тань хадгалагдахгүй."
      footer={
        <>
          <LoadingButton
            type="submit"
            form={FORM_ID}
            variant="secondary"
            loading={busy === "save"}
            disabled={busy !== null}
          >
            Ноорог хадгалах
          </LoadingButton>
          <LoadingButton
            type="button"
            loading={busy === "send"}
            disabled={busy !== null}
            onClick={() => void send()}
          >
            {draft?.when === "scheduled" ? "Хуваарьлах" : "Илгээх"}
          </LoadingButton>
        </>
      }
    >
      {draft && preview && (
        <form
          id={FORM_ID}
          onSubmit={saveDraft}
          noValidate
          className="space-y-6"
        >
          {/* Урьдчилсан харагдац — хонхны жагсаалт ба toast-д яг ингэж гарна. */}
          <section className="space-y-3" aria-label="Урьдчилан харах">
            <div className="bg-card rounded-xl border p-2">
              <NotificationItem notification={preview} onOpen={() => {}} />
            </div>
            <div className="pointer-events-none">
              <NotificationToast
                notification={preview}
                onOpen={() => {}}
                onClose={() => {}}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy !== null}
              onClick={() => void test()}
            >
              {busy === "test" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              Надад туршиж илгээх
            </Button>
          </section>

          <section className="space-y-4">
            <Field label="Төрөл" error={errors.kind}>
              <Select
                value={draft.kind}
                onValueChange={(v) => set("kind", v as BroadcastKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROADCAST_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {BROADCAST_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Гарчиг"
              hint={`${draft.title.length}/${BROADCAST_TITLE_MAX}`}
              error={errors.title}
            >
              <Input
                value={draft.title}
                maxLength={BROADCAST_TITLE_MAX}
                placeholder="Шинэ үнэртэн ирлээ"
                className={fieldErrorClass(errors.title)}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field
              label="Текст"
              hint={`${draft.body.length}/${BROADCAST_BODY_MAX} · заавал биш`}
              error={errors.body}
            >
              <textarea
                rows={3}
                maxLength={BROADCAST_BODY_MAX}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
                className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Холбоос</h3>
            <LinkTargetPicker
              onPick={(t) => {
                set("url", t.url);
                if (!draft.imageUrl && t.imageUrl) set("imageUrl", t.imageUrl);
              }}
            />
            <Field
              label="Зам эсвэл хаяг"
              hint="Дарахад шилжих газар: «/catalog» гэх мэт зам эсвэл https:// хаяг. Хоосон бол хаашаа ч шилжихгүй."
              error={errors.url}
            >
              <Input
                value={draft.url}
                maxLength={500}
                placeholder="/catalog"
                className={fieldErrorClass(errors.url)}
                onChange={(e) => set("url", e.target.value)}
              />
            </Field>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Зураг</h3>
            <IconUpload
              value={draft.imageUrl}
              onChange={(url) => set("imageUrl", url)}
              folder="notifications"
              label="Зураг"
              size={64}
            />
            <p className="text-muted-foreground text-xs">
              Заавал биш. Дөрвөлжин зураг тохиромжтой — жагсаалтад 48px-ээр
              харагдана. Зураггүй бол төрлийн дүрс гарна.
            </p>
            {errors.imageUrl && (
              <p className="text-destructive text-xs">{errors.imageUrl}</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Хэзээ илгээх</h3>
            <Select
              value={draft.when}
              onValueChange={(v) => set("when", v as Draft["when"])}
            >
              <SelectTrigger aria-label="Хэзээ илгээх">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Одоо</SelectItem>
                <SelectItem value="scheduled">Тодорхой цагт</SelectItem>
              </SelectContent>
            </Select>
            {draft.when === "scheduled" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Өдөр" error={errors.schedule}>
                  <DatePicker
                    value={draft.day}
                    clearable={false}
                    onChange={(v) => set("day", v)}
                  />
                </Field>
                <Field label="Цаг" hint="Улаанбаатарын цагаар, ±5 минут">
                  <Select
                    value={draft.time}
                    onValueChange={(v) => set("time", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TIMES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </section>
        </form>
      )}
    </FormDrawer>
  );
}

/** Бараа / багц хайж холбоос сонгох — хайлт нь сервер дээр. */
function LinkTargetPicker({
  onPick,
}: {
  onPick: (t: BroadcastLinkTarget) => void;
}) {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<BroadcastLinkTarget[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [opened, setOpened] = React.useState(false);
  const term = q.trim();

  React.useEffect(() => {
    if (!opened) return;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(
      async () => {
        const res = await adminFetch<{ items: BroadcastLinkTarget[] }>(
          `/api/admin/broadcasts/link-targets?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setFailed(!res.ok);
        if (res.ok) setItems(res.data.items);
        setLoading(false);
      },
      term ? 250 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [term, opened]);

  const status = loading ? (
    <>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Хайж байна…
    </>
  ) : failed ? (
    "Хайлт амжилтгүй. Дахин оролдоно уу."
  ) : null;

  return (
    <Combobox
      items={items}
      value={null}
      onValueChange={(next: BroadcastLinkTarget | null) => {
        if (next) onPick(next);
      }}
      itemToStringLabel={(t: BroadcastLinkTarget) => t.label}
      isItemEqualToValue={(a: BroadcastLinkTarget, b: BroadcastLinkTarget) =>
        a.url === b.url
      }
      filter={null}
      inputValue={q}
      onInputValueChange={setQ}
      onOpenChange={(o) => {
        setOpened(o);
        if (!o) setQ("");
      }}
    >
      <ComboboxTrigger>
        <ComboboxValue placeholder="Бараа эсвэл багцаас сонгох" />
      </ComboboxTrigger>
      <PickerPopup aria-busy={loading || undefined}>
        <ComboboxInput
          placeholder="Нэрээр хайх"
          aria-label="Бараа, багц хайх"
        />
        <ComboboxScroll>
          <ComboboxStatus>{status}</ComboboxStatus>
          <ComboboxEmpty>{!loading && !failed && "Олдсонгүй."}</ComboboxEmpty>
          <ComboboxList>
            {(t: BroadcastLinkTarget) => (
              <ComboboxItem key={t.url} value={t}>
                <span className="truncate">
                  {t.label}
                  <span className="text-muted-foreground">
                    {" "}
                    · {t.type === "product" ? "Бараа" : "Багц"}
                  </span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxScroll>
      </PickerPopup>
    </Combobox>
  );
}
