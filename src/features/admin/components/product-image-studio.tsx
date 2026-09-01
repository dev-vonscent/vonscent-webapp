"use client";

import * as React from "react";
import Image from "next/image";
import { AlertTriangle, ImagePlus, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { cn } from "@/lib/utils";
import {
  GalleryDropzone,
  GalleryGrid,
  MAX_IMAGES,
  useProductGallery,
  type GalleryImage,
} from "./product-images";

/**
 * Everything a product's pictures need, in one block at the top of both forms.
 *
 * It replaces the popup that used to hang off the products table, which split
 * the work in two: the gallery was edited down the form while approving and
 * regenerating the AI image happened in a dialog on a different screen.
 *
 * The block reads in the order the work happens. The gallery comes first, and
 * below it one «Зураг нэмэх» panel with the two ways to add a picture behind a
 * toggle: upload a finished photo, or feed the AI a reference bottle.
 *
 * There is one list, not two. Uploads and generated images are both ordinary
 * gallery rows (0049) — a finished generation files itself there — and the
 * admin's choice is *which of them the storefront shows*, made on the tiles
 * themselves. Nothing here changes whether the product is visible: that stays
 * with the form's «Идэвхтэй» checkbox.
 */

export type GenStatus = "none" | "pending" | "generating" | "done" | "failed";

type AddMode = "upload" | "ai";

const isBusy = (s: GenStatus) => s === "pending" || s === "generating";

export function ProductImageStudio({
  productId,
  initialImages = [],
  initialReference = null,
  initialStatus = "none",
  initialError = null,
  aiEnabled,
  onImagesChange,
  onReferenceChange,
}: {
  /** Absent while creating: there is no row to attach anything to yet. */
  productId?: string;
  initialImages?: GalleryImage[];
  initialReference?: string | null;
  initialStatus?: GenStatus;
  initialError?: string | null;
  /** `isImageGenConfigured` — server-only env, so the page passes it in. */
  aiEnabled: boolean;
  onImagesChange?: (images: GalleryImage[]) => void;
  onReferenceChange?: (url: string | null) => void;
}) {
  const persisted = Boolean(productId);

  const gallery = useProductGallery({
    productId,
    initial: initialImages,
    onChange: onImagesChange,
  });

  const [reference, setReference] = React.useState<string | null>(
    initialReference,
  );
  const [refBusy, setRefBusy] = React.useState(false);
  const [adjust, setAdjust] = React.useState("");
  const [status, setStatus] = React.useState<GenStatus>(initialStatus);
  const [genError, setGenError] = React.useState<string | null>(initialError);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  // A product that already works from a reference opens on the AI side; every
  // other one opens on the plainer path.
  const [mode, setMode] = React.useState<AddMode>(
    aiEnabled && initialReference ? "ai" : "upload",
  );

  const fileRef = React.useRef<HTMLInputElement>(null);

  const { replaceImages } = gallery;
  /** Re-read the gallery: a finished job files its result as a row server-side. */
  const refreshGallery = React.useCallback(async () => {
    if (!productId) return;
    const r = await adminFetch<{ images?: GalleryImage[] }>(
      `/api/admin/products/${productId}/images`,
    );
    if (r.ok && r.data?.images) replaceImages(r.data.images);
  }, [productId, replaceImages]);

  // Poll only while a job is actually in flight, and stop as soon as it lands.
  React.useEffect(() => {
    if (!productId || !isBusy(status)) return;
    const iv = setInterval(async () => {
      const r = await adminFetch<{
        statuses?: { status: GenStatus; error: string | null }[];
      }>(`/api/admin/products/image-status?ids=${productId}`);
      const s = r.ok ? r.data?.statuses?.[0] : null;
      if (!s) return;
      setStatus(s.status);
      setGenError(s.error);
      if (!isBusy(s.status)) refreshGallery();
    }, 4000);
    return () => clearInterval(iv);
  }, [productId, status, refreshGallery]);

  function applyReference(url: string | null) {
    setReference(url);
    onReferenceChange?.(url);
  }

  // Reference bottle
  async function uploadReference(file: File) {
    setNote(null);
    const prepared = await prepareUpload(file);
    if (!prepared.ok) {
      setNote(prepared.message);
      return;
    }
    setRefBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", prepared.file);
      let res;
      if (productId) {
        res = await adminFetch<{ url?: string }>(
          `/api/admin/products/${productId}/reference-image`,
          { method: "POST", body: fd },
        );
      } else {
        // No product row yet — stage it in the same folder the gallery uses.
        fd.append("folder", "products/new");
        res = await adminFetch<{ url?: string }>("/api/upload", {
          method: "POST",
          body: fd,
        });
      }
      if (!res.ok) {
        setNote(res.demo ? "Demo горим: зураг хадгалагдсангүй." : res.error);
      } else if (!res.data?.url) {
        setNote("Оруулахад алдаа гарлаа.");
      } else {
        applyReference(res.data.url);
      }
    } finally {
      setRefBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clearReference() {
    setNote(null);
    if (!productId) return applyReference(null);
    setRefBusy(true);
    const res = await adminFetch(
      `/api/admin/products/${productId}/reference-image`,
      { method: "DELETE" },
    );
    setRefBusy(false);
    if (res.ok) applyReference(null);
    else setNote(res.error);
  }

  /** Reuse a picture the product already has instead of uploading it twice. */
  async function adoptFromGallery(url: string) {
    setNote(null);
    if (!productId) return applyReference(url);
    setRefBusy(true);
    const ok = await mutateJson(
      `/api/admin/products/${productId}/reference-image`,
      "POST",
      { url },
      "Лавлах зураг тохируулж чадсангүй",
    );
    setRefBusy(false);
    if (ok) applyReference(url);
  }

  // Generate
  async function generate() {
    if (!productId || busy || !reference) return;
    setBusy(true);
    setNote(null);
    const body: { adjust?: string; referenceUrl?: string } = {
      referenceUrl: reference,
    };
    const tweak = adjust.trim();
    if (tweak) body.adjust = tweak;
    const ok = await mutateJson(
      `/api/admin/products/${productId}/regenerate-image`,
      "POST",
      body,
      "Зураг үүсгэж эхэлсэнгүй",
    );
    setBusy(false);
    if (ok) {
      setStatus("generating");
      setGenError(null);
    }
  }

  const hasUnselected = gallery.images.some((img) => !img.visible);

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="font-serif text-lg font-semibold">Зураг</h2>
          {isBusy(status) ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              AI зураг үүсгэж байна…
            </span>
          ) : status === "failed" ? (
            <span className="text-destructive flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" />
              AI зураг амжилтгүй
            </span>
          ) : hasUnselected ? (
            <span className="text-gold-strong flex items-center gap-1.5 text-xs">
              <Sparkles className="size-3.5" />
              Сонгогдоогүй зураг байна
            </span>
          ) : null}
        </div>

        {/* Галерей */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="text-sm font-medium">Галерей</h3>
            <p className="text-muted-foreground text-xs">
              {gallery.images.length > 0
                ? `Сайтад ${gallery.visibleCount} / ${gallery.images.length} зураг харагдана`
                : `0 / ${MAX_IMAGES} зураг`}
              {gallery.images.length > 1 && " · чирж эрэмбэлнэ"}
            </p>
          </div>
          {gallery.images.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Оруулсан ба AI-аар үүсгэсэн бүх зураг энд байна. Зураг бүрийн доод
              талын шошгыг дарж сайтад харагдахыг нь сонгоно — эхний харагдах
              зураг үндсэн зураг болно.
            </p>
          )}
          <GalleryGrid g={gallery} />
        </section>

        {/* Зураг нэмэх */}
        <section className="bg-secondary/40 space-y-4 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Зураг нэмэх</h3>

            {aiEnabled && (
              <div
                role="tablist"
                aria-label="Зураг нэмэх арга"
                className="bg-background flex gap-1 rounded-lg p-1 text-sm"
              >
                {(
                  [
                    ["upload", "Бэлэн зураг", UploadCloud],
                    ["ai", "AI-аар үүсгэх", Sparkles],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                      mode === value
                        ? "bg-secondary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/*
              Say why, rather than just vanishing. `aiEnabled` is
              `isImageGenConfigured`, i.e. whether OPENAI_API_KEY is present on
              the server — and because `.env*` is gitignored, a deployment that
              was never given the key in its own environment simply loses this
              whole feature with no message. That looks like a bug and is not
              traceable from the screen.
            */}
            {!aiEnabled && (
              <p className="text-muted-foreground text-xs">
                AI-аар үүсгэх идэвхгүй — серверт{" "}
                <code className="font-mono">OPENAI_API_KEY</code> тохируулаагүй
                байна.
              </p>
            )}
          </div>

          {!aiEnabled || mode === "upload" ? (
            <GalleryDropzone g={gallery} />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* Reference bottle. The tile is the control — an empty slot
                    that only a neighbouring button could fill read as
                    decoration on a borderless surface. */}
                <div className="shrink-0 space-y-1.5">
                  <p className="text-xs font-medium">Лавлах зураг</p>
                  <button
                    type="button"
                    disabled={refBusy}
                    onClick={() => fileRef.current?.click()}
                    aria-label={
                      reference ? "Лавлах зураг солих" : "Лавлах зураг сонгох"
                    }
                    className={cn(
                      "bg-muted text-muted-foreground relative block aspect-3/4 w-28 overflow-hidden rounded-lg transition-colors",
                      !reference && "field-edge hover:bg-accent",
                    )}
                  >
                    {refBusy ? (
                      <span className="flex size-full items-center justify-center">
                        <Loader2 className="size-5 animate-spin" />
                      </span>
                    ) : reference ? (
                      <Image
                        src={reference}
                        alt="Лавлах зураг"
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-1.5">
                        <ImagePlus className="size-5" />
                        <span className="text-xs">Сонгох</span>
                      </span>
                    )}
                  </button>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {reference ? (
                      <>
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={refBusy}
                          className="text-gold-strong"
                        >
                          Солих
                        </button>
                        <button
                          type="button"
                          onClick={clearReference}
                          disabled={refBusy}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          Хасах
                        </button>
                      </>
                    ) : (
                      gallery.images.length > 0 && (
                        <button
                          type="button"
                          onClick={() => adoptFromGallery(gallery.images[0].url)}
                          disabled={refBusy}
                          className="text-gold-strong text-left"
                        >
                          Галерейн эхнийхийг авах
                        </button>
                      )
                    )}
                  </div>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadReference(file);
                  }}
                />

                {/* Controls */}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Лавлах зураг сайтад гарахгүй, галерейд ч орохгүй — AI зөвхөн
                    савны хэлбэр, шошгыг үүнээс хуулж, эргэн тойрны дүр зургийг
                    шинээр зурна. Үүссэн зураг галерейд{" "}
                    <b>сонгогдоогүй</b> байдлаар нэмэгдэнэ.
                  </p>

                  {persisted ? (
                    <>
                      <label className="block text-xs font-medium">
                        Засвар{" "}
                        <span className="text-muted-foreground font-normal">
                          (сонголттой)
                        </span>
                        <textarea
                          value={adjust}
                          onChange={(e) => setAdjust(e.target.value)}
                          rows={2}
                          placeholder="Жишээ: фоныг илүү харанхуй болго"
                          className="bg-background field-edge placeholder:text-muted-foreground mt-1 w-full resize-none rounded-md p-2 text-base md:text-sm"
                        />
                      </label>
                      <Button
                        type="button"
                        onClick={generate}
                        disabled={!reference || busy || isBusy(status)}
                        className="w-full sm:w-auto"
                      >
                        {isBusy(status) ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {isBusy(status)
                          ? "Үүсгэж байна…"
                          : status === "none"
                            ? "AI-аар үүсгэх"
                            : "Дахин үүсгэх"}
                      </Button>
                      {!reference && (
                        <p className="text-muted-foreground text-xs">
                          Эхлээд лавлах зураг оруулна уу.
                        </p>
                      )}
                    </>
                  ) : (
                    <p
                      className={cn(
                        "rounded-md px-2.5 py-2 text-xs",
                        reference
                          ? "bg-background text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {reference
                        ? "Барааг хадгалахад энэ савнаас AI зураг үүсч, галерейд нэмэгдэнэ. Сайтад харагдуулахыг нь засах хуудаснаас сонгоно."
                        : "Савны зургаа сонгоход хадгалахтай зэрэг AI зураг үүсгэж эхэлнэ."}
                    </p>
                  )}

                  {status === "failed" && genError && (
                    <p className="bg-destructive/10 text-destructive rounded-md px-2.5 py-2 text-xs">
                      {genError}
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}

          {note && (
            <p role="alert" className="text-destructive text-xs">
              {note}
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
