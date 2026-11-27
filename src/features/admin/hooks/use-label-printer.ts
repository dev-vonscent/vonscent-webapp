"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import {
  LABEL_PAPERS,
  connectPrinter,
  drawAddressLabel,
  drawPerfumePage,
  isWebBluetoothAvailable,
  loadLabelAssets,
  printLabels,
  printerName,
  subscribePrinter,
  type LabelLogo,
  type PrintJob,
} from "@/features/admin/lib/niimbot-printer";
import type { PerfumeLabelItem } from "@/features/admin/lib/order-label";
import type { OrderRow } from "@/db/types";

export type LabelKind = "address" | "perfume";

interface LabelData {
  items: PerfumeLabelItem[];
  giftWrapOrderIds: string[];
  remoteOrderIds: string[];
}

/**
 * Тасарсан хэвлэлт (цаас/цэнэг дууссан, холболт тасарсан, «Зогсоох») —
 * алдаа гарсан шошгоос нь «Үргэлжлүүлэх». Модулийн түвшинд нэг л байна:
 * жагсаалт ↔ дэлгэрэнгүй хуудас хооронд шилжихэд алга болохгүй, хуудас
 * refresh хийхэд л арилна.
 */
interface PendingRun {
  kind: LabelKind;
  jobs: PrintJob[];
  /** Дараа хэвлэх шошгоны индекс — алдаа гарсан шошго өөрөө (хагас
   *  хэвлэгдсэн байж болох тул дахин хэвлэнэ). */
  next: number;
  /** Нийт хэвлэгдсэн шошгоны түлхүүр. */
  printed: string[];
  /** Аль хэдийн «хэвлэсэн» гэж тэмдэглэсэн захиалга. */
  marked: Set<string>;
  ordersOf: (keys: string[]) => string[];
  /** Алдааны текст; «Зогсоох» бол null. */
  error: string | null;
}

let pending: PendingRun | null = null;
const pendingListeners = new Set<() => void>();
function setPending(next: PendingRun | null) {
  pending = next;
  pendingListeners.forEach((l) => l());
}
function subscribePending(l: () => void) {
  pendingListeners.add(l);
  return () => pendingListeners.delete(l);
}

const unitOf = (kind: LabelKind) => (kind === "perfume" ? "хуудас" : "шошго");

/**
 * Шошго хэвлэх урсгал (0202, `label_print`) — захиалгын жагсаалт ба
 * дэлгэрэнгүй хуудас хоёулаа ашиглана: хэвлэгч холбох, хаяг/усны шошго
 * хэвлэх, «Зогсоох», тасарсан газраас «Үргэлжлүүлэх», хэвлэгдсэн
 * захиалгыг тэмдэглэх.
 *
 * Хэвлэсэн тэмдэглэл: хаяг — шошго нь хэвлэгдсэн захиалга; ус — бүх
 * шошго нь (хос хуудсаар) хэвлэгдсэн захиалга. Дутуу хэвлэгдсэн
 * захиалга тэмдэглэгдэхгүй (үргэлжлүүлж дуусгахад тэмдэглэгдэнэ).
 */
export function useLabelPrinter({
  onPrinted,
}: {
  /** Бүх шошго алдаагүй, зогсоолгүй хэвлэгдсэний дараа. */
  onPrinted?: (kind: LabelKind) => void;
} = {}) {
  const router = useRouter();
  const printer = React.useSyncExternalStore(
    subscribePrinter,
    printerName,
    () => null,
  );
  const paused = React.useSyncExternalStore(
    subscribePending,
    () => pending,
    () => null,
  );
  const [supported, setSupported] = React.useState(true);
  const [busy, setBusy] = React.useState<null | "connect" | LabelKind>(null);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [stopping, setStopping] = React.useState(false);
  const abort = React.useRef<AbortController | null>(null);
  // toast-ийн «Үргэлжлүүлэх» товч `resume`-г дуудна — тойрог хамаарлаас
  // зайлсхийж ref-ээр.
  const resumeRef = React.useRef<() => void>(() => undefined);

  React.useEffect(() => setSupported(isWebBluetoothAvailable()), []);

  const connect = React.useCallback(async (): Promise<boolean> => {
    setBusy("connect");
    try {
      const name = await connectPrinter();
      toast.success(`${name} хэвлэгчтэй холбогдлоо.`, "Хэвлэгч");
      return true;
    } catch (e) {
      // Хэрэглэгч сонгох цонхыг хаавал NotFoundError — алдаа биш.
      if (!(e instanceof DOMException && e.name === "NotFoundError")) {
        toast.error(
          e instanceof Error ? e.message : String(e),
          "Хэвлэгчтэй холбогдсонгүй",
        );
      }
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const stop = React.useCallback(() => {
    abort.current?.abort();
    setStopping(true);
  }, []);

  /** `run.next`-ээс эхлэн хэвлэнэ; тасарвал `pending`-д хадгална. */
  const run = React.useCallback(
    async (state: PendingRun) => {
      const { kind, jobs, next: start } = state;
      setPending(null);
      setBusy(kind);
      const controller = new AbortController();
      abort.current = controller;
      const total = jobs.length;
      setProgress(`${start}/${total}`);

      let result;
      let startError: string | null = null;
      try {
        result = await printLabels(
          jobs.slice(start),
          (n) => setProgress(`${start + n}/${total}`),
          controller.signal,
        );
      } catch (e) {
        // Эхлэхээс өмнө унасан (холболтгүй г.м.) — байсан газраасаа хүлээнэ.
        startError = e instanceof Error ? e.message : String(e);
        result = null;
      }
      abort.current = null;
      setBusy(null);
      setProgress(null);
      setStopping(false);
      if (!result) {
        setPending({ ...state, error: startError });
        toast.errorWithActions(
          `${start}/${total} ${unitOf(kind)} хэвлэгдсэн. ${startError}`,
          "Хэвлэлт эхэлсэнгүй",
          [{ label: "Үргэлжлүүлэх", onClick: () => resumeRef.current() }],
        );
        return;
      }

      const printed = [...state.printed, ...result.printed];
      const done = start + result.printed.length;
      const fresh = state
        .ordersOf(printed)
        .filter((id) => !state.marked.has(id));
      if (fresh.length > 0) {
        const ok = await mutateJson(
          "/api/admin/orders/label-printed",
          "POST",
          { ids: fresh, kind },
          "Хэвлэсэн тэмдэглэл хадгалагдсангүй",
        );
        if (ok) fresh.forEach((id) => state.marked.add(id));
        router.refresh();
      }

      const count = `${done}/${total} ${unitOf(kind)}`;
      if (result.error || result.stopped) {
        setPending({
          ...state,
          next: done,
          printed,
          error: result.error,
        });
        const resume = [
          { label: "Үргэлжлүүлэх", onClick: () => resumeRef.current() },
        ];
        if (result.error) {
          toast.errorWithActions(
            `${count} хэвлэгдлээ. ${result.error}. Цаас, цэнэгээ шалгаад үргэлжлүүлнэ үү.`,
            "Хэвлэлт тасарлаа",
            resume,
          );
        } else {
          toast(`${count} хэвлэгдээд зогслоо.`, "Зогсоосон");
        }
      } else {
        toast.success(`${total} ${unitOf(kind)} хэвлэгдлээ.`, "Хэвлэсэн");
        onPrinted?.(kind);
      }
    },
    [onPrinted, router],
  );

  const resume = React.useCallback(async () => {
    const state = pending;
    if (!state) return;
    // Цэнэг дуусч унтарсан бол холболт тасарсан — товшилтоор дахин холбоно.
    if (!printerName() && !(await connect())) return;
    await run(state);
  }, [connect, run]);
  React.useEffect(() => {
    resumeRef.current = () => void resume();
  }, [resume]);

  /** Тасарсан хэвлэлтийг орхино (үлдсэн шошго хэвлэгдэхгүй). */
  const discard = React.useCallback(() => setPending(null), []);

  const print = React.useCallback(
    async (kind: LabelKind, orders: OrderRow[]) => {
      if (orders.length === 0) return;
      // Холбогдоогүй бол энэ товшилтоор шууд сонгох цонх нээнэ.
      if (!printerName() && !(await connect())) return;
      setBusy(kind);

      let built: { jobs: PrintJob[]; ordersOf: (keys: string[]) => string[] };
      try {
        const [{ logo }, res] = await Promise.all([
          loadLabelAssets(),
          adminFetch<LabelData>("/api/admin/orders/label-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: orders.map((o) => o.id) }),
          }),
        ]);
        if (!res.ok) {
          toast.error(res.error, "Захиалгын мэдээлэл ирсэнгүй");
          return setBusy(null);
        }
        built =
          kind === "address"
            ? addressJobs(orders, res.data, logo)
            : perfumeJobs(orders, res.data, logo);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e), "Хэвлэсэнгүй");
        return setBusy(null);
      }
      if (built.jobs.length === 0) {
        toast("Сонгосон захиалгад хэвлэх ус алга.", "Усны шошго");
        return setBusy(null);
      }
      // Шинэ хэвлэлт эхлэхэд өмнөх тасарсныг орхино.
      await run({
        kind,
        jobs: built.jobs,
        next: 0,
        printed: [],
        marked: new Set(),
        ordersOf: built.ordersOf,
        error: null,
      });
    },
    [connect, run],
  );

  /**
   * Захиалгагүй, бэлэн шошгууд (/admin/orders/labels) — санд «хэвлэсэн»
   * тэмдэглэхгүй. Зогсоох / үргэлжлүүлэх нь захиалгын хэвлэлттэй адил.
   */
  const printJobs = React.useCallback(
    async (kind: LabelKind, jobs: PrintJob[]) => {
      if (jobs.length === 0) return;
      if (!printerName() && !(await connect())) return;
      await run({
        kind,
        jobs,
        next: 0,
        printed: [],
        marked: new Set(),
        ordersOf: () => [],
        error: null,
      });
    },
    [connect, run],
  );

  return {
    supported,
    printer,
    busy,
    progress,
    stopping,
    paused,
    connect,
    print,
    printJobs,
    stop,
    resume,
    discard,
  };
}

function addressJobs(
  orders: OrderRow[],
  data: LabelData,
  logo: LabelLogo | null,
) {
  const giftWrap = new Set(data.giftWrapOrderIds);
  const remote = new Set(data.remoteOrderIds);
  return {
    jobs: orders.map<PrintJob>((o) => ({
      key: o.id,
      label: o.order_no,
      draw: (dpi) =>
        drawAddressLabel(o, dpi, logo, {
          giftWrap: giftWrap.has(o.id),
          remote: remote.has(o.id),
        }),
    })),
    // Хаягийн шошгоны түлхүүр нь захиалгын id өөрөө.
    ordersOf: (keys: string[]) => keys,
  };
}

function perfumeJobs(
  orders: OrderRow[],
  data: LabelData,
  logo: LabelLogo | null,
) {
  // Захиалгын дарааллаар (жагсаалт дээрх шиг), мөр бүр qty удаа.
  const orderNo = new Map(orders.map((o) => [o.id, o.order_no]));
  const rank = new Map(orders.map((o, i) => [o.id, i]));
  const labels = [...data.items]
    .sort((a, b) => (rank.get(a.order_id) ?? 0) - (rank.get(b.order_id) ?? 0))
    .flatMap((it) =>
      Array.from({ length: Math.max(1, it.qty) }, () => ({
        orderId: it.order_id,
        brand: it.brand,
        name: it.name,
        ml: it.ml,
        orderNo: orderNo.get(it.order_id) ?? "",
      })),
    );
  const { jobs, pages } = perfumePageJobs(
    labels,
    logo,
    (l) => `${l.orderNo} ${l.brand} ${l.name}`,
  );
  /** Захиалга бүрийн сүүлчийн шошго аль хуудсанд. */
  const lastPage = new Map<string, string>();
  pages.forEach((page, i) => {
    for (const l of page) lastPage.set(l.orderId, String(i));
  });
  return {
    jobs,
    // Хуудас дарааллаар хэвлэгддэг тул сүүлчийн хуудас нь хэвлэгдсэн бол
    // тухайн захиалгын бүх шошго хэвлэгдсэн.
    ordersOf: (keys: string[]) => {
      const done = new Set(keys);
      return [...lastPage]
        .filter(([, key]) => done.has(key))
        .map(([orderId]) => orderId);
    },
  };
}

/**
 * Усны шошгыг хос цаасны хуудсуудад хуваана (LABEL_PAPERS.perfume.perPage):
 * нэг хуудсанд хоёр ус, сондгой бол сүүлийн доод шошго хоосон. Job-ийн
 * түлхүүр нь хуудасны индекс.
 */
export function perfumePageJobs<
  T extends { brand: string; name: string; ml?: number | null },
>(labels: readonly T[], logo: LabelLogo | null, describe: (l: T) => string) {
  const { perPage } = LABEL_PAPERS.perfume;
  const pages: T[][] = [];
  for (let i = 0; i < labels.length; i += perPage) {
    pages.push(labels.slice(i, i + perPage));
  }
  const jobs = pages.map<PrintJob>((page, i) => ({
    key: String(i),
    label: page.map(describe).join(", "),
    draw: (dpi) => drawPerfumePage(page, dpi, logo),
  }));
  return { jobs, pages };
}
