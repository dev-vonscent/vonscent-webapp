"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { adminFetch, mutate, mutateJson } from "@/features/admin/lib/mutate";
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
import { Badge } from "@/components/ui/badge";
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

/** One row of the `image-status` poll response. */
type ImageStatus = Partial<CellState> & { status: CellState["status"] };

const isBusy = (s: string) => s === "pending" || s === "generating";

export function ProductImageCell({
  product,
  referenceSeed,
  large,
}: {
  product: CellProduct;
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
      const r = await adminFetch<{ statuses?: ImageStatus[] }>(
        `/api/admin/products/image-status?ids=${product.id}`,
      );
      const s = r.ok ? r.data?.statuses?.[0] : null;
      // Merge rather than replace: a field the route omits should keep its
      // previous value, not blank the cell.
      if (s) setState((prev) => ({ ...prev, ...s }));
    }, 4000);
    return () => clearInterval(iv);
  }, [state.status, product.id]);

  const thumb = state.published ?? state.resultUrl;
  const unapproved =
    state.status === "done" &&
    !!state.resultUrl &&
    state.resultUrl !== state.published;

  // The one thing this cell has to say beyond "here is the picture": an AI
  // image finished generating and is waiting for a human to publish it.
  const hint = unapproved
    ? "AI зураг бэлэн болсон ч хараахан нийтлээгүй. Дарж хараад батална уу."
    : "Зураг харах / удирдах";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hint}
        title={hint}
        className={cn(
          "bg-muted relative shrink-0 overflow-hidden rounded-md",
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
      </button>

      {/* Beside the thumbnail, not on it. Overlaying the word made it 8px and
          unreadable; replacing the word with a bare dot made it unreadable in
          a different way — a marker nobody can name is not a marker. The
          column has the width, so the state says what it is. */}
      {unapproved && (
        <Badge className="bg-warning/15 text-warning shrink-0" title={hint}>
          Батлаагүй
        </Badge>
      )}

      {open && (
        <ImagePopup
          product={product}
          state={state}
          setState={setState}
          referenceSeed={referenceSeed}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ImagePopup({
  product,
  state,
  setState,
  referenceSeed,
  onClose,
}: {
  product: CellProduct;
  state: CellState;
  setState: React.Dispatch<React.SetStateAction<CellState>>;
  referenceSeed?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  // Empty by default — a small adjustment instruction, not the whole prompt.
  const [adjust, setAdjust] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);

  const loadHistory = React.useCallback(async () => {
    const r = await adminFetch<{ generations?: HistoryItem[] }>(
      `/api/admin/products/${product.id}/generations`,
    );
    setHistory(r.ok ? (r.data?.generations ?? []) : []);
  }, [product.id]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Keep the popup live while a job runs.
  React.useEffect(() => {
    if (!isBusy(state.status)) return;
    const iv = setInterval(async () => {
      const r = await adminFetch<{ statuses?: ImageStatus[] }>(
        `/api/admin/products/image-status?ids=${product.id}`,
      );
      const s = r.ok ? r.data?.statuses?.[0] : null;
      if (s) {
        setState((prev) => ({ ...prev, ...s }));
        if (!isBusy(s.status)) loadHistory();
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [state.status, product.id, setState, loadHistory]);

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    // The server rebuilds the full prompt from the product + the base prompt in
    // build-image-prompt.ts; we only send the optional small adjustment. An
    // empty field regenerates from the reference image + base prompt alone and
    // appends the result as a new generation.
    const body: { adjust?: string; referenceUrl?: string } = {};
    const tweak = adjust.trim();
    if (tweak) body.adjust = tweak;
    // Always hand the server a reference so it can preserve the bottle: an
    // edit-page seed, otherwise the product's current image. The server still
    // prefers the product's saved original reference when it has one.
    const ref = referenceSeed ?? state.published ?? state.resultUrl;
    if (ref) body.referenceUrl = ref;
    const ok = await mutateJson(
      `/api/admin/products/${product.id}/regenerate-image`,
      "POST",
      body,
      "Зураг үүсгэж эхэлсэнгүй",
    );
    setBusy(false);
    if (ok)
      setState((prev) => ({ ...prev, status: "generating", error: null }));
  }

  async function approve() {
    setBusy(true);
    const ok = await mutate(
      `/api/admin/products/${product.id}/approve-image`,
      { method: "POST" },
      "Зураг нийтлэгдсэнгүй",
    );
    setBusy(false);
    if (ok) {
      setState((prev) => ({ ...prev, published: prev.resultUrl }));
      router.refresh();
    }
  }

  async function revert(generationId: string) {
    setBusy(true);
    const ok = await mutateJson(
      `/api/admin/products/${product.id}/revert-image`,
      "POST",
      { generationId },
      "Зураг сэргээгдсэнгүй",
    );
    setBusy(false);
    if (ok) {
      const item = history.find((h) => h.id === generationId);
      setState((prev) => ({
        ...prev,
        published: item?.resultUrl ?? prev.published,
      }));
      router.refresh();
    }
  }

  // Show the newest generation result first so a fresh regenerate is visible
  // immediately; fall back to the published image when there is no result yet.
  const big = state.resultUrl ?? state.published;
  const unapproved =
    state.status === "done" &&
    !!state.resultUrl &&
    state.resultUrl !== state.published;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-4">
        <DialogTitle className="font-serif">{product.name} — зураг</DialogTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Preview */}
          <div className="bg-muted relative aspect-4/5 overflow-hidden rounded-xl">
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
                className="bg-secondary field-edge placeholder:text-muted-foreground mt-1 w-full resize-none rounded-md p-2 text-base md:text-sm"
              />
            </label>
            <p className="text-muted-foreground -mt-1 text-xs">
              Хоосон бол лавлах зураг + үндсэн prompt-оор шинээр үүсгэнэ.
            </p>
            <Button
              onClick={regenerate}
              disabled={busy || isBusy(state.status)}
            >
              <Sparkles className="size-4" /> Дахин үүсгэх
            </Button>
            {unapproved && (
              <Button variant="secondary" onClick={approve} disabled={busy}>
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
                    aria-label="Энэ хувилбарыг сэргээх"
                    title="Энэ хувилбарыг сэргээх"
                    className={cn(
                      "bg-muted group relative size-16 shrink-0 overflow-hidden rounded-md",
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
                    {/* A scrim over an arbitrary photograph, not over a theme
                        surface: DESIGN.md sanctions a literal dark scrim here
                        precisely because the image underneath is the same in
                        all three themes. */}
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
