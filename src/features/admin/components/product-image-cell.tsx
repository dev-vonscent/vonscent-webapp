"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertTriangle,
  ImageIcon,
  Sparkles,
  Check,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CellProduct {
  id: string;
  name: string;
  isActive: boolean;
  imageUrl: string | null;
  imageStatus: "none" | "pending" | "generating" | "done" | "failed";
  imageResultUrl: string | null;
  imageGenId: string | null;
  imagePrompt: string;
  imageError: string | null;
}

interface CellState {
  status: CellProduct["imageStatus"];
  published: string | null;
  resultUrl: string | null;
  generationId: string | null;
  prompt: string;
  error: string | null;
}

interface HistoryItem {
  id: string;
  status: string;
  prompt: string;
  resultUrl: string | null;
  createdAt: string;
}

const isBusy = (s: string) => s === "pending" || s === "generating";

export function ProductImageCell({
  product,
  promptSeed,
  referenceSeed,
  large,
}: {
  product: CellProduct;
  /** Default prompt for a product with no prior generation (edit page). */
  promptSeed?: string;
  /** Reference image for the first generation (edit page). */
  referenceSeed?: string | null;
  /** Render a larger thumbnail (edit page). */
  large?: boolean;
}) {
  const [state, setState] = React.useState<CellState>({
    status: product.imageStatus,
    published: product.imageUrl,
    resultUrl: product.imageResultUrl,
    generationId: product.imageGenId,
    prompt: product.imagePrompt,
    error: product.imageError,
  });
  const [open, setOpen] = React.useState(false);

  // Poll while a job is in flight.
  React.useEffect(() => {
    if (!isBusy(state.status)) return;
    const iv = setInterval(async () => {
      const r = await fetch(
        `/api/admin/products/image-status?ids=${product.id}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      const s = r?.statuses?.[0];
      if (s)
        setState({
          status: s.status,
          published: s.published,
          resultUrl: s.resultUrl,
          generationId: s.generationId,
          prompt: s.prompt,
          error: s.error,
        });
    }, 4000);
    return () => clearInterval(iv);
  }, [state.status, product.id]);

  const thumb = state.published ?? state.resultUrl;
  const unapproved =
    state.status === "done" && !!state.resultUrl && !state.published;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Зураг харах / удирдах"
        className={cn(
          "border-border bg-muted relative shrink-0 overflow-hidden rounded-md border",
          large ? "size-24" : "size-12",
        )}
      >
        {isBusy(state.status) ? (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            <Loader2 className="size-5 animate-spin" />
          </span>
        ) : state.status === "failed" ? (
          <span className="text-destructive flex size-full items-center justify-center">
            <AlertTriangle className="size-5" />
          </span>
        ) : thumb ? (
          <Image
            src={thumb}
            alt={product.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            <ImageIcon className="size-5" />
          </span>
        )}
        {unapproved && (
          <span className="bg-gold-strong absolute inset-x-0 bottom-0 py-px text-center text-[8px] font-semibold text-white">
            батлаагүй
          </span>
        )}
      </button>

      {open && (
        <ImagePopup
          product={product}
          state={state}
          setState={setState}
          promptSeed={promptSeed}
          referenceSeed={referenceSeed}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ImagePopup({
  product,
  state,
  setState,
  promptSeed,
  referenceSeed,
  onClose,
}: {
  product: CellProduct;
  state: CellState;
  setState: React.Dispatch<React.SetStateAction<CellState>>;
  promptSeed?: string;
  referenceSeed?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  // Empty by default — a small adjustment instruction, not the whole prompt.
  const [adjust, setAdjust] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);

  const loadHistory = React.useCallback(async () => {
    const r = await fetch(`/api/admin/products/${product.id}/generations`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    setHistory(r?.generations ?? []);
  }, [product.id]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Keep the popup live while a job runs.
  React.useEffect(() => {
    if (!isBusy(state.status)) return;
    const iv = setInterval(async () => {
      const r = await fetch(
        `/api/admin/products/image-status?ids=${product.id}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      const s = r?.statuses?.[0];
      if (s) {
        setState((prev) => ({ ...prev, ...s }));
        if (!isBusy(s.status)) loadHistory();
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [state.status, product.id, setState, loadHistory]);

  async function regenerate() {
    // The textarea holds a small adjustment; the real prompt is the last full
    // prompt (or the composed seed) with that tweak appended. Empty adjust just
    // re-rolls the same prompt.
    const base = state.prompt || promptSeed || "";
    const tweak = adjust.trim();
    const finalPrompt = base
      ? tweak
        ? `${base}\n\nAdjustment: ${tweak}`
        : base
      : tweak;
    if (!finalPrompt.trim() || busy) return;
    setBusy(true);
    // First generation for a non-AI product uses the current image as the
    // reference; once a job exists the route reuses that job's reference.
    const body: { prompt: string; referenceUrl?: string } = {
      prompt: finalPrompt,
    };
    if (!state.generationId && referenceSeed) body.referenceUrl = referenceSeed;
    const r = await fetch(
      `/api/admin/products/${product.id}/regenerate-image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setBusy(false);
    if (r.ok)
      setState((prev) => ({ ...prev, status: "generating", error: null }));
  }

  async function approve() {
    setBusy(true);
    const r = await fetch(`/api/admin/products/${product.id}/approve-image`, {
      method: "POST",
    });
    setBusy(false);
    if (r.ok) {
      setState((prev) => ({ ...prev, published: prev.resultUrl }));
      router.refresh();
    }
  }

  async function revert(generationId: string) {
    setBusy(true);
    const r = await fetch(`/api/admin/products/${product.id}/revert-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId }),
    });
    setBusy(false);
    if (r.ok) {
      const item = history.find((h) => h.id === generationId);
      setState((prev) => ({
        ...prev,
        published: item?.resultUrl ?? prev.published,
      }));
      router.refresh();
    }
  }

  const big = state.published ?? state.resultUrl;
  const unapproved =
    state.status === "done" && !!state.resultUrl && !state.published;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-4">
        <DialogTitle className="font-serif">{product.name} — зураг</DialogTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Preview */}
          <div className="border-border bg-muted relative aspect-4/5 overflow-hidden rounded-xl border">
            {isBusy(state.status) ? (
              <span className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 text-sm">
                <Loader2 className="size-7 animate-spin" /> Үүсгэж байна…
              </span>
            ) : state.status === "failed" ? (
              <span className="text-destructive flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm">
                <AlertTriangle className="size-7" />
                {state.error || "Үүсгэлт амжилтгүй боллоо."}
              </span>
            ) : big ? (
              <Image
                src={big}
                alt={product.name}
                fill
                sizes="320px"
                className="object-cover"
              />
            ) : (
              <span className="text-muted-foreground flex size-full items-center justify-center">
                <ImageIcon className="size-8" />
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              Засвар (сонголттой)
              <textarea
                value={adjust}
                onChange={(e) => setAdjust(e.target.value)}
                rows={3}
                placeholder="Жишээ: Доор байгаа чулууг илүү бодит болго"
                className="border-border bg-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 w-full resize-none rounded-md border p-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
            </label>
            <p className="text-muted-foreground -mt-1 text-xs">
              Хоосон бол ижил prompt-оор дахин үүсгэнэ.
            </p>
            <Button
              onClick={regenerate}
              disabled={busy || isBusy(state.status)}
            >
              <Sparkles className="size-4" /> Дахин үүсгэх
            </Button>
            {unapproved && (
              <Button variant="outline" onClick={approve} disabled={busy}>
                <Check className="size-4" /> Батлаж нийтлэх
              </Button>
            )}
          </div>
        </div>

        {/* History */}
        {history.filter((h) => h.status === "done" && h.resultUrl).length >
          1 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Түүх
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history
                .filter((h) => h.status === "done" && h.resultUrl)
                .map((h) => (
                  <button
                    key={h.id}
                    onClick={() => revert(h.id)}
                    disabled={busy}
                    title="Энэ хувилбарыг сэргээх"
                    className={cn(
                      "border-border group relative size-16 shrink-0 overflow-hidden rounded-md border",
                      state.published === h.resultUrl &&
                        "ring-gold-strong ring-2",
                    )}
                  >
                    {h.resultUrl && (
                      <Image
                        src={h.resultUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                      <RotateCcw className="size-4 text-white" />
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
