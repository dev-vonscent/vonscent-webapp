"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  dayEndIso,
  dayStartIso,
  ubToday,
} from "@/features/admin/lib/date-range";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import {
  saleEventFieldErrors,
  saleEventInputSchema,
  type SaleEventInput,
} from "@/lib/validators/sale-event";
import { saleEventPhase, type OverlapConflict } from "../../lib";
import type { SaleEventAdminRow, SaleEventPhase } from "../../types";
import {
  hasBlocking,
  studioChecklist,
  type StudioBanner,
} from "./studio-checklist";
import {
  draftFromRow,
  draftToInput,
  emptyDraft,
  publishAction,
  saveMode,
  withName,
  withSlug,
  type PublishAction,
  type StudioDraft,
} from "./studio-model";

/** Толгойд үргэлж харагдах хадгалалтын байдал (D7). */
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  /** Ноорог нь серверт очихооргүй (нэр хоосон, хувь буруу …). */
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

export type StudioErrors = Partial<Record<keyof SaleEventInput, string>>;

interface Meta {
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

type PersistResult =
  | { ok: true; id: string }
  | { ok: false; invalid: boolean; message: string };

const AUTOSAVE_MS = 2000;

/**
 * Студийн төлөв ба хадгалалт (studio-ux.md D7):
 *   · мөр хараахан алга → ①-ийн «Үргэлжлүүлэх» ноорог үүсгэнэ (`create`);
 *   · ноорог → 2 секундийн дараа, мөн алхам солих бүрт автоматаар;
 *   · товлосон / явж буй → зөвхөн «Хадгалах» дээр (явж буйд баталгаажуулна);
 *   · дууссан → засахгүй (fixes.md F1; сан өөрөө `EVENT_ENDED` шиднэ).
 *
 * Бүх бичилт нэг дараалалд (`enqueue`) орно: хоцорсон автомат хадгалалт
 * (`isActive: false`) нийтлэлтийн ДАРАА очиж буцааж ноорог болгохгүй.
 */
export function useEventStudio(input: {
  row: SaleEventAdminRow | null;
  copyOf: SaleEventAdminRow | null;
  banner: StudioBanner | null;
  bannerEnabled: boolean;
  /** Серверийн цаг — эхний render хоёр талд ижил төлөвтэй гарна. */
  now: number;
}) {
  const { row, copyOf, banner, bannerEnabled } = input;
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();

  const [initial] = React.useState<StudioDraft>(() =>
    row
      ? draftFromRow(row)
      : copyOf
        ? draftFromRow(copyOf, { copy: true })
        : emptyDraft(),
  );
  const [draft, setDraft] = React.useState(initial);
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(initial));
  const [meta, setMeta] = React.useState<Meta | null>(
    row
      ? { isActive: row.isActive, startsAt: row.startsAt, endsAt: row.endsAt }
      : null,
  );
  const [errors, setErrors] = React.useState<StudioErrors>({});
  const [conflicts, setConflicts] = React.useState<OverlapConflict[]>([]);
  const [status, setStatus] = React.useState<SaveStatus>({ kind: "idle" });
  const [busy, setBusy] = React.useState<
    "create" | "save" | "publish" | "stop" | null
  >(null);
  /** Энэ нээлтэд нийтэлсэн бол амжилтын төлөв (§5.5). */
  const [published, setPublished] = React.useState<PublishAction | null>(null);
  const [now, setNow] = React.useState(input.now);

  // Төлөв цагаас хамаарна (товлосон → явж байна) — минут тутам шинэчилнэ.
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const id = row?.id ?? null;
  const phase: SaleEventPhase | null = meta ? saleEventPhase(meta, now) : null;
  const mode = saveMode(phase);
  const today = ubToday(new Date(now));
  const dirty = JSON.stringify(draft) !== baseline;

  const checklist = React.useMemo(
    () => studioChecklist({ draft, today, conflicts, banner, bannerEnabled }),
    [draft, today, conflicts, banner, bannerEnabled],
  );

  // Асинхрон ажил (дараалал, timer, unmount) хамгийн сүүлийн утгыг ref-ээс уншина.
  const live = React.useRef({ draft, baseline, meta });
  React.useEffect(() => {
    live.current = { draft, baseline, meta };
  }, [draft, baseline, meta]);

  const chain = React.useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = React.useCallback(<T,>(task: () => Promise<T>) => {
    const run = chain.current.then(task, task);
    chain.current = run.catch(() => undefined);
    return run;
  }, []);

  const persist = React.useCallback(
    async (d: StudioDraft, isActive: boolean): Promise<PersistResult> => {
      const parsed = saleEventInputSchema.safeParse(draftToInput(d, isActive));
      if (!parsed.success) {
        setErrors(saleEventFieldErrors(parsed.error));
        return {
          ok: false,
          invalid: true,
          message: parsed.error.issues[0]?.message ?? "Маягтаа шалгана уу.",
        };
      }
      const res = await adminFetch<{
        id?: string;
        conflicts?: OverlapConflict[];
      }>(id ? `/api/admin/sale-events/${id}` : "/api/admin/sale-events", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        setConflicts(res.data?.conflicts ?? []);
        return { ok: false, invalid: false, message: res.error };
      }
      const nextBaseline = JSON.stringify(d);
      const nextMeta: Meta = {
        isActive,
        startsAt: dayStartIso(d.startsOn) ?? "",
        endsAt: dayEndIso(d.endsOn) ?? "",
      };
      // Дарааллын дараагийн ажил state-ийн render-ийг хүлээхгүй — ref-ийг шууд.
      live.current = { ...live.current, baseline: nextBaseline, meta: nextMeta };
      setBaseline(nextBaseline);
      setMeta(nextMeta);
      setConflicts([]);
      setErrors({});
      setNow(Date.now());
      return { ok: true, id: res.data.id ?? id ?? "" };
    },
    [id],
  );

  /** Ноорогийн автомат хадгалалт. Өөрчлөлтгүй / ноорог биш бол юу ч хийхгүй. */
  const autosave = React.useCallback(
    () =>
      enqueue(async (): Promise<boolean> => {
        const { draft: d, baseline: b, meta: m } = live.current;
        if (!id || !m || m.isActive) return true;
        if (JSON.stringify(d) === b) return true;
        setStatus({ kind: "saving" });
        const r = await persist(d, false);
        setStatus(
          r.ok
            ? { kind: "saved", at: Date.now() }
            : { kind: r.invalid ? "invalid" : "error", message: r.message },
        );
        return r.ok;
      }),
    [enqueue, id, persist],
  );

  // Засвар дууссанаас 2 секундийн дараа (D7).
  React.useEffect(() => {
    if (mode !== "auto" || !dirty) return;
    const t = setTimeout(() => void autosave(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [mode, dirty, draft, autosave]);

  // Хуудаснаас гарахад (sidebar-ийн холбоос г.м.) ноорогийн сүүлийн өөрчлөлтийг
  // явуулна — хариуг хүлээхгүй. Хүчингүй ноорог сервер рүү очихгүй.
  React.useEffect(
    () => () => {
      const { draft: d, baseline: b, meta: m } = live.current;
      if (!id || !m || m.isActive || JSON.stringify(d) === b) return;
      const parsed = saleEventInputSchema.safeParse(draftToInput(d, false));
      if (!parsed.success) return;
      void adminFetch(`/api/admin/sale-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        keepalive: true,
      });
    },
    [id],
  );

  // Хадгалаагүй өөрчлөлттэй таб хаах / сэргээх (D7).
  const unsaved = mode === "locked" ? false : dirty;
  React.useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  // ── Засвар ──────────────────────────────────────────────────────────────

  function patch(next: Partial<StudioDraft>) {
    if (mode === "locked") return;
    setDraft((d) => ({ ...d, ...next }));
    setErrors((e) => {
      const out = { ...e };
      for (const key of Object.keys(next)) {
        delete out[key as keyof SaleEventInput];
      }
      return out;
    });
    // Давхцал нь бараа + хугацаанаас хамаарна — аль нэг нь солигдвол хуучирна.
    if ("items" in next || "startsOn" in next || "endsOn" in next) {
      setConflicts([]);
    }
  }

  function setName(name: string) {
    if (mode === "locked") return;
    setDraft((d) => withName(d, name));
    setErrors((e) => ({ ...e, name: undefined, slug: undefined }));
  }

  function setSlug(slug: string) {
    if (mode === "locked") return;
    setDraft((d) => withSlug(d, slug));
    setErrors((e) => ({ ...e, slug: undefined }));
  }

  /** «Болих» — сүүлд хадгалсан утга руу буцна (товлосон / явж буй). */
  function revert() {
    setDraft(JSON.parse(baseline) as StudioDraft);
    setErrors({});
    setConflicts([]);
  }

  // ── Үйлдлүүд ────────────────────────────────────────────────────────────

  /** ①-ийн «Үргэлжлүүлэх»: ноорог мөр үүсгээд ② руу. */
  async function create() {
    if (id || busy) return;
    setBusy("create");
    try {
      const r = await enqueue(() => persist(draft, false));
      if (!r.ok) {
        toast.error(r.message, "Үүсгэж чадсангүй");
        return;
      }
      router.replace(`/admin/sale-events/${r.id}?step=products`);
    } finally {
      setBusy(null);
    }
  }

  /** Товлосон / явж буй арга хэмжээг хадгалах. */
  async function saveManual(): Promise<boolean> {
    if (mode !== "manual" || busy) return false;
    // Явж буй арга хэмжээг засах нь дэлгүүрт шууд нөлөөлнө (plan §9.1).
    if (phase === "live") {
      const ok = await confirm({
        title: "Одоо дэлгүүрт шууд нөлөөлнө",
        description:
          "Явж буй арга хэмжээний үнэ, бараа, текст хадгалмагц дэлгүүрт солигдоно.",
        confirmLabel: "Хадгалах",
      });
      if (!ok) return false;
    } else if (publishAction(draft.startsOn, today) === "start") {
      // Товлосон арга хэмжээний эхлэх өдрийг өнөөдөр / өнгөрсөн болгосон.
      const ok = await confirm({
        title: "Арга хэмжээ одоо эхэлнэ",
        description:
          "Эхлэх өдөр өнөөдөр эсвэл өнгөрсөн тул хадгалмагц хямдрал дэлгүүрт эхэлнэ.",
        confirmLabel: "Хадгалаад эхлүүлэх",
      });
      if (!ok) return false;
    }
    setBusy("save");
    setStatus({ kind: "saving" });
    try {
      const r = await enqueue(() => persist(live.current.draft, true));
      if (!r.ok) {
        setStatus({
          kind: r.invalid ? "invalid" : "error",
          message: r.message,
        });
        toast.error(r.message, "Хадгалагдсангүй");
        return false;
      }
      setStatus({ kind: "saved", at: Date.now() });
      toast.success("Хадгалагдлаа.");
      return true;
    } finally {
      setBusy(null);
    }
  }

  /** ⑤-ын «Товлох» / «Одоо эхлүүлэх». */
  async function publish(): Promise<boolean> {
    if (mode !== "auto" || busy) return false;
    if (hasBlocking(checklist)) {
      toast.error("Улаанаар тэмдэглэсэн зүйлсийг засна уу.", "Нийтлэх боломжгүй");
      return false;
    }
    if (checklist.some((i) => i.step === "banner" && i.level === "warn")) {
      const ok = await confirm({
        title: "Баннергүйгээр нийтлэх үү?",
        description:
          "Нүүрний баннер дутуу тул нүүр хуудсанд гарахгүй. Үнэ, каталогийн шүүлтүүр хэвийн ажиллана; баннерыг дараа нь нэмж болно.",
        confirmLabel: "Нийтлэх",
      });
      if (!ok) return false;
    }
    const action = publishAction(draft.startsOn, today);
    setBusy("publish");
    setStatus({ kind: "saving" });
    try {
      const r = await enqueue(() => persist(live.current.draft, true));
      if (!r.ok) {
        setStatus({
          kind: r.invalid ? "invalid" : "error",
          message: r.message,
        });
        toast.error(r.message, "Нийтлэгдсэнгүй");
        return false;
      }
      setStatus({ kind: "saved", at: Date.now() });
      setPublished(action);
      return true;
    } finally {
      setBusy(null);
    }
  }

  /** «Зогсоох» — одоогийн логик (`stop_sale_event`): түүх үлдэнэ. */
  async function stop() {
    if (!id || busy || (phase !== "live" && phase !== "scheduled")) return;
    const name = draft.name.trim() || "Арга хэмжээ";
    const ok = await confirm({
      title: `«${name}»-г зогсоох уу?`,
      description:
        phase === "live"
          ? "Үнэ яг одоо үндсэн (эсвэл өмнөх гар хямдрал) руугаа буцна. Арга хэмжээ түүхэнд үлдэнэ."
          : "Нийтлэлээс буцаж ноорог болно. Дэлгүүрт юу ч өөрчлөгдөхгүй.",
      confirmLabel: "Зогсоох",
      destructive: phase === "live",
    });
    if (!ok) return;
    setBusy("stop");
    try {
      const res = await adminFetch(`/api/admin/sale-events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      if (!res.ok) {
        toast.error(res.error, "Зогсоож чадсангүй");
        return;
      }
      toast.success(`«${name}» зогслоо.`);
      // Серверийн шинэ мөрөөр студи дахин эхэлнэ (хуудас `key`-ээр солино).
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  /**
   * Студиэс гарах (жагсаалт руу г.м.) — true бол явж болно. Ноорог эхлээд
   * хадгалагдана; хадгалагдаагүй өөрчлөлт үлдвэл асууна (D7).
   */
  async function confirmLeave(): Promise<boolean> {
    if (mode === "locked" || !dirty) return true;
    if (mode === "auto" && (await autosave())) return true;
    return confirm({
      title: "Хадгалаагүй өөрчлөлт байна",
      description: "Гарвал сүүлд хийсэн өөрчлөлт тань хадгалагдахгүй.",
      confirmLabel: "Гарах",
      cancelLabel: "Үлдэх",
      destructive: true,
    });
  }

  return {
    id,
    draft,
    /** Хадгалагдсан `ends_at` — зогсоосон цагийг шугамд харуулахад. */
    endsAt: meta?.endsAt ?? null,
    phase,
    mode,
    today,
    dirty,
    errors,
    conflicts,
    checklist,
    status,
    busy,
    published,
    banner,
    confirmDialog,
    patch,
    setName,
    setSlug,
    revert,
    create,
    autosave,
    saveManual,
    publish,
    stop,
    confirmLeave,
  };
}

export type EventStudio = ReturnType<typeof useEventStudio>;
