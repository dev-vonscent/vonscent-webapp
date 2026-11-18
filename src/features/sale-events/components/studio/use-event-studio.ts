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
import { heroInputSchema } from "@/lib/validators/hero";
import type { HeroCanvasDraft } from "@/features/heroes/canvas-model";
import type { HeroAdminRow } from "@/features/heroes/types";
import {
  saleEventFieldErrors,
  saleEventInputSchema,
  type SaleEventInput,
} from "@/lib/validators/sale-event";
import { saleEventPhase, type OverlapConflict } from "../../lib";
import type { SaleEventAdminRow, SaleEventPhase } from "../../types";
import {
  bannerPayload,
  bannerSummary,
  initialBannerState,
  staleBannerDates,
  syncBannerCopy,
  type BannerState,
} from "./studio-banner";
import { hasBlocking, studioChecklist } from "./studio-checklist";
import { bundleChecklistState } from "./studio-bundles";
import type { SaleEventBundleOption } from "../../bundles";

const EMPTY_BUNDLES: readonly SaleEventBundleOption[] = [];
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

const json = (v: unknown) => (v == null ? "" : JSON.stringify(v));

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
 *
 * Баннер (④, D6): хадгалах дараалал **арга хэмжээ → баннер** (одоогийн хоёр
 * route). Баннер унавал арга хэмжээ хадгалагдсан хэвээр, алдаа ④-т гарна.
 */
export function useEventStudio(input: {
  row: SaleEventAdminRow | null;
  copyOf: SaleEventAdminRow | null;
  /** Энэ арга хэмжээний баннер (`heroes.sale_event_id`). */
  bannerRow: HeroAdminRow | null;
  /** Хуулж буй арга хэмжээний баннер — шинэ мөр болж хуулагдана. */
  copyBanner: HeroAdminRow | null;
  bannerEnabled: boolean;
  /** Бэлэн багц (16.7) — туг `sale_event_bundles`; хаалттай бол хоосон. */
  bundleOptions?: readonly SaleEventBundleOption[];
  bundlesEnabled?: boolean;
  /** Серверийн цаг — эхний render хоёр талд ижил төлөвтэй гарна. */
  now: number;
}) {
  const { row, copyOf, bannerEnabled } = input;
  const bundlesEnabled = input.bundlesEnabled ?? false;
  const bundleOptions = input.bundleOptions ?? EMPTY_BUNDLES;
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

  // ── Баннер ──────────────────────────────────────────────────────────────
  const [bannerInit] = React.useState<BannerState>(() =>
    initialBannerState({
      row: bannerEnabled ? (input.bannerRow ?? input.copyBanner) : null,
      newGroupId: crypto.randomUUID(),
      copy:
        !input.bannerRow && input.copyBanner && copyOf
          ? { fromSlug: copyOf.slug, toSlug: initial.slug }
          : undefined,
    }),
  );
  const [banner, setBannerState] = React.useState(bannerInit);
  /** Сүүлд хадгалсан төлөв («Болих» үүн рүү). */
  const [bannerBase, setBannerBase] = React.useState(bannerInit);
  /** Сүүлд серверт очсон оролт — өөрчлөлт байгаа эсэхийг үүгээр. */
  const [bannerSaved, setBannerSaved] = React.useState(() =>
    row && input.bannerRow
      ? json(
          bannerPayload({
            state: bannerInit,
            event: initial,
            eventId: row.id,
            knownSlugs: [row.slug],
          }),
        )
      : "",
  );
  const [bannerError, setBannerError] = React.useState<string | null>(null);
  /** Энэ арга хэмжээний хадгалагдсан холбоосууд — товч тэднийг дагана (D5). */
  const [knownSlugs, setKnownSlugs] = React.useState<string[]>(() =>
    [row?.slug, copyOf?.slug].filter((x): x is string => Boolean(x)),
  );

  // Төлөв цагаас хамаарна (товлосон → явж байна) — минут тутам шинэчилнэ.
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const id = row?.id ?? null;
  const phase: SaleEventPhase | null = meta ? saleEventPhase(meta, now) : null;
  const mode = saveMode(phase);
  const today = ubToday(new Date(now));
  const eventDirty = JSON.stringify(draft) !== baseline;
  const bannerNext =
    id && bannerEnabled
      ? json(
          bannerPayload({
            state: banner,
            event: draft,
            eventId: id,
            knownSlugs,
          }),
        )
      : "";
  const bannerDirty = bannerNext !== "" && bannerNext !== bannerSaved;
  const dirty = eventDirty || bannerDirty;

  const summary = React.useMemo(() => bannerSummary(banner), [banner]);
  const staleDates = React.useMemo(
    () =>
      bannerEnabled && banner.draft && !banner.skip
        ? staleBannerDates(banner.draft, draft)
        : [],
    [bannerEnabled, banner.draft, banner.skip, draft],
  );
  const bundleState = React.useMemo(
    () =>
      bundlesEnabled
        ? bundleChecklistState(draft, bundleOptions, {
            eventId: row?.id ?? null,
            now,
          })
        : null,
    [bundlesEnabled, draft, bundleOptions, row?.id, now],
  );
  const checklist = React.useMemo(
    () =>
      studioChecklist({
        bundles: bundleState,
        draft,
        today,
        conflicts,
        banner: summary,
        bannerEnabled,
        bannerSkipped: banner.skip,
        bannerError,
        bannerStaleDates: staleDates,
      }),
    [draft, today, conflicts, summary, bannerEnabled, banner.skip, bannerError, staleDates, bundleState],
  );

  // Нэр, огноо, хувь солигдоход баннерын бэлэн текст (админ хөндөөгүй
  // талбар) дагана — «11/13–11/14» гэх мэт хуучин огноо үлдэхгүй (§6.2).
  const prevDraft = React.useRef(draft);
  React.useEffect(() => {
    const prev = prevDraft.current;
    prevDraft.current = draft;
    if (prev === draft) return;
    setBannerState((s) => {
      if (!s.draft) return s;
      const synced = syncBannerCopy(s.draft, prev, draft);
      return synced === s.draft ? s : { ...s, draft: synced };
    });
  }, [draft]);

  // Асинхрон ажил (дараалал, timer, unmount) хамгийн сүүлийн утгыг ref-ээс уншина.
  const live = React.useRef({ draft, baseline, meta, banner, bannerSaved, knownSlugs });
  React.useEffect(() => {
    live.current = { draft, baseline, meta, banner, bannerSaved, knownSlugs };
  }, [draft, baseline, meta, banner, bannerSaved, knownSlugs]);

  const chain = React.useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = React.useCallback(<T,>(task: () => Promise<T>) => {
    const run = chain.current.then(task, task);
    chain.current = run.catch(() => undefined);
    return run;
  }, []);

  const persist = React.useCallback(
    async (d: StudioDraft, isActive: boolean): Promise<PersistResult> => {
      const parsed = saleEventInputSchema.safeParse(
        draftToInput(d, isActive, {
          bundles: bundlesEnabled,
          // 0191: хадгалсан төлөвтэй харьцуулж зөвхөн ИЛЭРХИЙ хасалтыг явуулна.
          base: id ? (JSON.parse(live.current.baseline) as StudioDraft) : null,
        }),
      );
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
      if (!live.current.knownSlugs.includes(d.slug)) {
        const slugs = [...live.current.knownSlugs, d.slug];
        live.current = { ...live.current, knownSlugs: slugs };
        setKnownSlugs(slugs);
      }
      setBaseline(nextBaseline);
      setMeta(nextMeta);
      setConflicts([]);
      setErrors({});
      setNow(Date.now());
      return { ok: true, id: res.data.id ?? id ?? "" };
    },
    [id, bundlesEnabled],
  );

  /**
   * Баннерыг хадгална (арга хэмжээ хадгалагдсаны ДАРАА). Явуулах юм байхгүй
   * эсвэл өөрчлөлтгүй бол ok. Алдаа нь ④-т ба checklist-д (D7).
   */
  const persistBanner = React.useCallback(
    async (eventId: string): Promise<boolean> => {
      if (!bannerEnabled) return true;
      const { draft: d, banner: s, bannerSaved: saved } = live.current;
      const payload = bannerPayload({
        state: s,
        event: d,
        eventId,
        knownSlugs: live.current.knownSlugs,
      });
      if (!payload || json(payload) === saved) return true;
      const parsed = heroInputSchema.safeParse(payload);
      if (!parsed.success) {
        setBannerError(parsed.error.issues[0]?.message ?? "Баннераа шалгана уу.");
        return false;
      }
      const res = await adminFetch<{ id?: string }>(
        s.id ? `/api/admin/heroes/${s.id}` : "/api/admin/heroes",
        {
          method: s.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!res.ok) {
        setBannerError(res.error);
        return false;
      }
      const next: BannerState = { ...s, id: s.id ?? res.data.id ?? null };
      const nextSaved = json(payload);
      live.current = { ...live.current, banner: next, bannerSaved: nextSaved };
      // Хадгалж байх хооронд хийсэн засварыг дарахгүй — зөвхөн id-г нэмнэ.
      setBannerState((cur) => ({ ...cur, id: next.id }));
      setBannerBase(next);
      setBannerSaved(nextSaved);
      setBannerError(null);
      return true;
    },
    [bannerEnabled],
  );

  /** Ноорогийн автомат хадгалалт. Өөрчлөлтгүй / ноорог биш бол юу ч хийхгүй. */
  const autosave = React.useCallback(
    () =>
      enqueue(async (): Promise<boolean> => {
        const { draft: d, baseline: b, meta: m, banner: s, bannerSaved: saved } =
          live.current;
        if (!id || !m || m.isActive) return true;
        const evDirty = JSON.stringify(d) !== b;
        const bnPayload = bannerEnabled
          ? json(
              bannerPayload({
                state: s,
                event: d,
                eventId: id,
                knownSlugs: live.current.knownSlugs,
              }),
            )
          : "";
        const bnDirty = bnPayload !== "" && bnPayload !== saved;
        if (!evDirty && !bnDirty) return true;
        setStatus({ kind: "saving" });
        if (evDirty) {
          const r = await persist(d, false);
          if (!r.ok) {
            setStatus({ kind: r.invalid ? "invalid" : "error", message: r.message });
            return false;
          }
        }
        const bannerOk = await persistBanner(id);
        setStatus({ kind: "saved", at: Date.now() });
        return bannerOk;
      }),
    [enqueue, id, persist, persistBanner, bannerEnabled],
  );

  // Засвар дууссанаас 2 секундийн дараа (D7).
  React.useEffect(() => {
    if (mode !== "auto" || !dirty) return;
    const t = setTimeout(() => void autosave(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [mode, dirty, draft, banner, autosave]);

  // Хуудаснаас гарахад (sidebar-ийн холбоос г.м.) ноорогийн сүүлийн өөрчлөлтийг
  // явуулна. Autosave-ийн дараалалд орно: явж буй хадгалалт дуусч (шинэ
  // баннерын id `live`-д орсны) дараа — давхар POST үүсэхгүй; арга хэмжээ →
  // баннер дарааллаар — шинэ slug-ийг баннерын товч олно. Хүчингүй ноорог
  // сервер рүү очихгүй.
  React.useEffect(
    () => () => {
      void enqueue(async () => {
        const { draft: d, baseline: b, meta: m } = live.current;
        if (!id || !m || m.isActive) return;
        if (JSON.stringify(d) !== b) {
          const parsed = saleEventInputSchema.safeParse(
            draftToInput(d, false, {
              bundles: bundlesEnabled,
              base: JSON.parse(b) as StudioDraft,
            }),
          );
          if (!parsed.success) return;
          const res = await adminFetch(`/api/admin/sale-events/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
            keepalive: true,
          });
          if (!res.ok) return;
        }
        if (!bannerEnabled) return;
        const { banner: s, bannerSaved: saved, knownSlugs } = live.current;
        const payload = bannerPayload({ state: s, event: d, eventId: id, knownSlugs });
        if (!payload || json(payload) === saved) return;
        const parsed = heroInputSchema.safeParse(payload);
        if (!parsed.success) return;
        await adminFetch(s.id ? `/api/admin/heroes/${s.id}` : "/api/admin/heroes", {
          method: s.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
          keepalive: true,
        });
      });
    },
    [id, bannerEnabled, enqueue, bundlesEnabled],
  );

  // Хадгалаагүй өөрчлөлттэй таб хаах / сэргээх (D7).
  const unsaved = mode === "locked" ? false : dirty;
  React.useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  // Товлосон / явж буй арга хэмжээ (гараар хадгалдаг): хадгалаагүй засвартай
  // үед sidebar г.м. холбоосоор гарвал асууна. `beforeunload` нь client
  // navigation-д ажилладаггүй, unmount-ийн хадгалалт ноорогт л явдаг тул
  // эс бөгөөс засвар чимээгүй алга болдог байв. Capture үед Next-ийн Link-ээс
  // өмнө барина.
  React.useEffect(() => {
    if (mode !== "manual" || !dirty) return;
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const a =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) {
        return;
      }
      const url = new URL(a.href, window.location.href);
      // Гадны холбоос → `beforeunload`; ижил хуудас (hash) → асуухгүй.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const ok = await confirm({
          title: "Хадгалаагүй өөрчлөлт байна",
          description: "Гарвал сүүлд хийсэн өөрчлөлт тань хадгалагдахгүй.",
          confirmLabel: "Гарах",
          cancelLabel: "Үлдэх",
          destructive: true,
        });
        if (ok) router.push(`${url.pathname}${url.search}${url.hash}`);
      })();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [mode, dirty, confirm, router]);

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

  /** ④ canvas-ийн засвар — анхны засвараар баннер «үүснэ» (§6.2). */
  function setBanner(next: HeroCanvasDraft) {
    if (mode === "locked") return;
    setBannerState((s) => ({ ...s, draft: next }));
    setBannerError(null);
  }

  /** «Энэ арга хэмжээнд баннер хэрэггүй». */
  function setBannerSkip(skip: boolean, current: HeroCanvasDraft) {
    if (mode === "locked") return;
    setBannerState((s) => ({ ...s, skip, draft: s.draft ?? (s.id ? current : null) }));
    setBannerError(null);
  }

  /** «Болих» — сүүлд хадгалсан утга руу буцна (товлосон / явж буй). */
  function revert() {
    setDraft(JSON.parse(baseline) as StudioDraft);
    setBannerState(bannerBase);
    setBannerError(null);
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
      // Хуулсан баннер — арга хэмжээний id-тай болсны дараа.
      if (!(await enqueue(() => persistBanner(r.id)))) {
        toast.error(
          "Арга хэмжээ үүслээ, баннер хуулагдсангүй — ④-р алхамд дахин оролдоно уу.",
        );
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
      if (eventDirty) {
        const r = await enqueue(() => persist(live.current.draft, true));
        if (!r.ok) {
          setStatus({
            kind: r.invalid ? "invalid" : "error",
            message: r.message,
          });
          toast.error(r.message, "Хадгалагдсангүй");
          return false;
        }
      }
      const bannerOk = id ? await enqueue(() => persistBanner(id)) : true;
      setStatus({ kind: "saved", at: Date.now() });
      if (bannerOk) toast.success("Хадгалагдлаа.");
      else toast.error("Арга хэмжээ хадгалагдсан, баннер хадгалагдсангүй — ④-р алхмыг харна уу.");
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
      if (id && !(await enqueue(() => persistBanner(id)))) {
        toast.error("Арга хэмжээ нийтлэгдсэн, баннер хадгалагдсангүй — ④-р алхмыг харна уу.");
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
        (phase === "live"
          ? "Үнэ яг одоо үндсэн (эсвэл өмнөх гар хямдрал) руугаа буцна. Арга хэмжээ түүхэнд үлдэнэ."
          : "Нийтлэлээс буцаж ноорог болно. Дэлгүүрт юу ч өөрчлөгдөхгүй.") +
        (dirty ? " Хадгалаагүй өөрчлөлт тань устна." : ""),
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
    now,
    dirty,
    errors,
    conflicts,
    bundleState,
    bundleOptions,
    bundlesEnabled,
    checklist,
    status,
    busy,
    published,
    banner,
    bannerSummary: summary,
    bannerError,
    bannerEnabled,
    confirmDialog,
    patch,
    setBanner,
    setBannerSkip,
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
