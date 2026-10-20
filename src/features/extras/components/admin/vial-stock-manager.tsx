"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import { formatDateTime, formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { VIAL_STYLE_SHORT, vialName } from "@/lib/vials";
import type { VialOption } from "../../types";
import { StockModeToggle, type StockMode } from "./stock-mode-toggle";
import { StockPurchaseForm } from "./stock-purchase-form";

const STYLES = ["black", "pink", "silver"] as const;
const COLORED_ML = [5, 10, 20] as const;

const MOVE_LABEL: Record<string, string> = {
  set: "Эхний тооллого",
  purchase: "Нөөц нөхсөн",
  adjust: "Тоо зассан",
  reserve: "Захиалгад орсон",
  release: "Суллагдсан",
  commit: "Хүргэгдсэн",
  restock: "Нөөцөд буцсан",
};

/** Нүдний текст — өнгө дангаараа биш, үгээр (design.md §9). */
export function vialStatus(v: VialOption): {
  text: string;
  tone: "ok" | "low" | "out" | "muted";
} {
  if (!v.isActive) return { text: "Түр хаасан", tone: "muted" };
  if (v.onHand == null) return { text: "Тоо оруулаагүй", tone: "muted" };
  const a = v.available ?? 0;
  if (a <= 0) return { text: "Дууссан", tone: "out" };
  if (a <= v.lowThreshold) return { text: `Цөөхөн · ${a}`, tone: "low" };
  return { text: String(a), tone: "ok" };
}

const TONE: Record<ReturnType<typeof vialStatus>["tone"], string> = {
  ok: "text-foreground",
  low: "text-gold-strong",
  out: "text-destructive",
  muted: "text-muted-foreground",
};

/**
 * Савны тоон нөөц (extras-shop-plan §8, туг `vial_inventory`): өнгө ×
 * хэмжээний хүснэгт, нүдэнд зарах боломжтой тоо. Нүдийг дарахад «Нийт тоо»,
 * «Захиалгад орсон», «Зарах боломжтой», анхааруулах тоо, түр хаах; сүүлийн
 * 20 хөдөлгөөн нь цонх доторх тусдаа хуудсанд. Утсан дээр өнгө бүр нэг карт.
 */
export function VialStockManager({ vials }: { vials: VialOption[] }) {
  const [open, setOpen] = React.useState<VialOption | null>(null);
  const find = (style: string | null, ml: number) =>
    vials.find((v) => v.style === style && v.ml === ml);

  const plain = [find(null, 2), find(null, 1)].filter((v): v is VialOption =>
    Boolean(v),
  );

  return (
    <div className="space-y-6">
      {/* Десктоп: хүснэгт */}
      <Card className="hidden md:block">
        <CardContent className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th className="py-2 text-left font-medium">Сав</th>
                {COLORED_ML.map((ml) => (
                  <th key={ml} className="py-2 font-medium">
                    {ml}ml
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STYLES.map((style) => (
                <tr key={style} className="border-border/60 border-t">
                  <th className="py-1 text-left font-medium">
                    {VIAL_STYLE_SHORT[style]} сав
                  </th>
                  {COLORED_ML.map((ml) => (
                    <td key={ml} className="py-1">
                      <VialCell onOpen={setOpen} v={find(style, ml)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Утас: өнгө бүрт карт */}
      <div className="grid gap-3 md:hidden">
        {STYLES.map((style) => (
          <Card key={style}>
            <CardContent className="space-y-2 p-4">
              <p className="font-medium">{VIAL_STYLE_SHORT[style]} сав</p>
              <div className="grid grid-cols-3 gap-2">
                {COLORED_ML.map((ml) => (
                  <div
                    key={ml}
                    className="bg-secondary rounded-lg p-1 text-center"
                  >
                    <span className="text-muted-foreground text-xs">
                      {ml}ml
                    </span>
                    <VialCell onOpen={setOpen} v={find(style, ml)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="divide-border divide-y p-0">
          {plain.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2">
              <span className="flex-1 text-sm font-medium">
                {v.ml === 2 ? "2ml сав (өнгөгүй)" : "1ml сав (бэлгийн дээж)"}
                {/* §18.1 №2 — зөвхөн тоолно, худалдан авалт тайланд орно. */}
                <span className="text-muted-foreground block text-xs font-normal">
                  Дангаар зарагдахгүй
                </span>
              </span>
              <div className="w-32">
                <VialCell onOpen={setOpen} v={v} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {open && (
        <VialDialog
          vial={vials.find((v) => v.id === open.id) ?? open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function VialCell({
  v,
  onOpen,
}: {
  v: VialOption | undefined;
  onOpen: (v: VialOption) => void;
}) {
  if (!v) return <span className="text-muted-foreground">—</span>;
  const s = vialStatus(v);
  return (
    <button
      type="button"
      onClick={() => onOpen(v)}
      className={cn(
        "hover:bg-accent flex min-h-11 w-full items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors",
        TONE[s.tone],
      )}
      aria-label={`${vialName(v)}: ${s.text}`}
    >
      {s.text}
    </button>
  );
}

interface Move {
  id: number;
  kind: string;
  deltaOnHand: number;
  deltaReserved: number;
  note: string;
  at: string;
  orderNo: string | null;
  /** `purchase`-д л — нийт авсан үнэ. */
  cost: number | null;
}

function VialDialog({
  vial,
  onClose,
}: {
  vial: VialOption;
  onClose: () => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = React.useState({
    onHand: vial.onHand,
    reserved: vial.reserved,
    updatedAt: vial.updatedAt,
  });
  const [count, setCount] = React.useState(
    vial.onHand == null ? "" : String(vial.onHand),
  );
  const [low, setLow] = React.useState(String(vial.lowThreshold));
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [moves, setMoves] = React.useState<Move[] | null>(null);
  const [mode, setMode] = React.useState<StockMode>("purchase");
  // Хөдөлгөөний түүх үндсэн хэсгийн зайг эзлэхгүй — дарахад цонх дотор
  // баруунаас гулсаж орох тусдаа хуудас.
  const [view, setView] = React.useState<"main" | "history" | "back">("main");
  const counted = current.onHand != null;
  const viewRef = React.useRef<HTMLDivElement>(null);
  // Хуудас солигдоход гүйлгээ дээрээс эхэлнэ — эс бөгөөс түүх рүү ороход
  // «Буцах» дээд талд нуугдаж үлдэнэ. Эцэг нь ResponsiveDialog-ийн гүйдэг хэсэг.
  React.useLayoutEffect(() => {
    const scroller = viewRef.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [view]);

  React.useEffect(() => {
    let cancelled = false;
    adminFetch<{ items: Move[] }>(`/api/admin/vials/${vial.id}/movements`).then(
      (r) => {
        if (!cancelled) setMoves(r.ok ? r.data.items : []);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [vial.id, current.updatedAt]);

  const n = Number(count.replace(/[\s,]/g, ""));
  const valid = count.trim() !== "" && Number.isInteger(n) && n >= 0;

  async function saveCount() {
    if (!valid) {
      setError("Тоо оруулна уу");
      return;
    }
    setBusy(true);
    const res = await adminFetch<{
      current: { onHand: number | null; reserved: number; updatedAt: string };
    }>("/api/admin/vials/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vialId: vial.id,
        count: n,
        expectedUpdatedAt: current.updatedAt,
        note,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      if (res.data?.current) setCurrent(res.data.current);
      setError(res.error);
      return;
    }
    setCurrent(res.data.current);
    setError(undefined);
    setNote("");
    toast.success(
      counted ? "Савны тоо засагдлаа" : "Эхний тооллого хадгалагдлаа",
    );
    router.refresh();
  }

  async function patch(body: object, done: string) {
    setBusy(true);
    const ok = await mutateJson(
      `/api/admin/vials/${vial.id}`,
      "PATCH",
      body,
      "Хадгалж чадсангүй",
    );
    setBusy(false);
    if (ok) {
      toast.success(done);
      router.refresh();
    }
  }

  const available =
    valid && current.onHand != null
      ? Math.max(current.onHand - current.reserved, 0)
      : null;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={vialName(vial)}
      footer={
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={onClose}
        >
          Хаах
        </Button>
      }
    >
      {view === "history" ? (
        <MoveHistory
          ref={viewRef}
          moves={moves}
          onBack={() => setView("back")}
        />
      ) : (
        <div
          ref={viewRef}
          className={cn(
            "space-y-5",
            // Түүхээс буцахад л зүүнээс гулсана; анх нээгдэхэд хөдөлгөөнгүй.
            view === "back" &&
              "animate-in fade-in-0 slide-in-from-left-8 duration-200",
          )}
        >
          {counted && <StockModeToggle value={mode} onChange={setMode} />}
          {counted && mode === "purchase" ? (
            <div className="space-y-3">
              <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-md px-3 py-2 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Нийт</dt>
                  <dd className="tabular-nums">{current.onHand}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Захиалгад орсон
                  </dt>
                  <dd className="tabular-nums">{current.reserved}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Ашиглах боломжтой
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {Math.max((current.onHand ?? 0) - current.reserved, 0)}
                  </dd>
                </div>
              </dl>
              <StockPurchaseForm
                endpoint="/api/admin/vials/purchase"
                target={{ vialId: vial.id }}
                current={current}
                onConflict={setCurrent}
                onSaved={(c) => {
                  setCurrent(c);
                  setCount(c.onHand == null ? "" : String(c.onHand));
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void saveCount();
              }}
              className="space-y-3"
            >
              <Field
                label={counted ? "Тоолсон нийт тоо" : "Эхний тооллого"}
                hint={
                  counted
                    ? "Тооллогоор зөрсөн үед л. Өртөг тайланд орохгүй — шинэ ачааг «Нөөц нөхөх»-өөр оруулна."
                    : "Одоо байгаа бүх савыг, грамаар савлагдаад хүргэгдээгүй захиалгынхыг оруулаад тоолно уу. Дараа нь шинэ ачааг «Нөөц нөхөх»-өөр нэмнэ."
                }
                error={error}
              >
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={count}
                  placeholder="Тоо оруулаагүй"
                  className="tabular-nums"
                  onChange={(e) => {
                    setCount(e.target.value);
                    setError(undefined);
                  }}
                />
              </Field>
              <dl className="bg-muted/40 grid grid-cols-2 gap-2 rounded-md px-3 py-2 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Захиалгад орсон
                  </dt>
                  <dd className="tabular-nums">{current.reserved}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    Зарах боломжтой
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {current.onHand == null ? "Тоо оруулаагүй" : available}
                  </dd>
                </div>
              </dl>
              <Field label="Тэмдэглэл" hint="Ж: Шинэ ачаа ирсэн">
                <Input
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <LoadingButton type="submit" loading={busy} className="w-full">
                {counted ? "Тоо засах" : "Тооллого хадгалах"}
              </LoadingButton>
            </form>
          )}

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <Field label="Цөөхөн гэж анхааруулах тоо">
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={low}
                className="tabular-nums"
                onChange={(e) => setLow(e.target.value)}
                onBlur={() => {
                  const v = Number(low);
                  if (
                    Number.isInteger(v) &&
                    v >= 0 &&
                    v !== vial.lowThreshold
                  ) {
                    void patch(
                      { lowThreshold: v },
                      "Анхааруулах тоо хадгалагдлаа",
                    );
                  }
                }}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                checked={!vial.isActive}
                disabled={busy}
                onCheckedChange={(c) =>
                  void patch(
                    { isActive: c !== true },
                    c === true ? "Түр хаалаа" : "Нээлээ",
                  )
                }
              />
              Түр хаах
            </label>
          </div>

          <button
            type="button"
            onClick={() => setView("history")}
            className="bg-secondary hover:bg-accent flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            <History className="text-muted-foreground size-4" aria-hidden />
            <span className="flex-1 text-left">Хөдөлгөөний түүх</span>
            <ChevronRight
              className="text-muted-foreground size-4"
              aria-hidden
            />
          </button>
        </div>
      )}
    </ResponsiveDialog>
  );
}

function MoveHistory({
  ref,
  moves,
  onBack,
}: {
  ref: React.Ref<HTMLDivElement>;
  moves: Move[] | null;
  onBack: () => void;
}) {
  return (
    <div
      ref={ref}
      className="animate-in fade-in-0 slide-in-from-right-8 space-y-3 duration-200"
    >
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1 text-sm font-medium transition-colors"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Буцах
      </button>
      <h3 className="text-sm font-medium">Сүүлийн 20 хөдөлгөөн</h3>
      {moves == null ? (
        <p className="text-muted-foreground text-xs">Уншиж байна…</p>
      ) : moves.length === 0 ? (
        <p className="text-muted-foreground text-xs">Хөдөлгөөн алга.</p>
      ) : (
        <ul className="divide-border divide-y text-xs">
          {moves.map((m) => (
            <li key={m.id} className="flex items-start gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block">
                  {MOVE_LABEL[m.kind] ?? m.kind}
                  {m.orderNo && ` · ${m.orderNo}`}
                  {m.note &&
                    !m.orderNo &&
                    m.note !== MOVE_LABEL[m.kind] &&
                    ` · ${m.note}`}
                </span>
                <span className="text-muted-foreground block tabular-nums">
                  {formatDateTime(m.at)}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                {m.deltaOnHand !== 0 &&
                  `${m.deltaOnHand > 0 ? "+" : ""}${m.deltaOnHand}`}
                {m.cost != null && (
                  <span className="text-muted-foreground block">
                    {formatPrice(m.cost)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
