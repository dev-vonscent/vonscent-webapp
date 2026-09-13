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

/**
 * Шинэ бараа үүсгэх үед автоматаар ажилладаг хоёр шат — энд гараар дуудагдана
 * (`/api/admin/products/[id]/generate-image`). Prompt нь серверт байдаг тул
 * энд зөвхөн нэр, тайлбар.
 */
const GENERATORS = [
  {
    kind: "packshot" as const,
    title: "Үндсэн зураг",
    description:
      "Лавлах савыг дэлгүүрийн жишиг цайвар саарал дэвсгэр дээр, бүх бараатай ижил хэмжээ, гэрэлтүүлэг, сүүдэртэйгээр буулгана.",
  },
  {
    kind: "notes" as const,
    title: "Үнэрийн ноттой зураг",
    description:
      "Савны ард үнэрийн орцууд (цэцэг, жимс, амтлагч) хөвсөн, хар дэвсгэртэй зураг. Барааны нотоос автоматаар сонгоно.",
  },
];

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
    // Галерейн зураг засварлаж эхэлмэгц доорх санал авалт асна — ажлын
    // төлөв хөтлөлт энэ компонент дээр нэг л газар байна.
    onEditStart: () => {
      setStatus("generating");
      setGenError(null);
    },
  });

  const [reference, setReference] = React.useState<string | null>(
    initialReference,
  );
  const [refBusy, setRefBusy] = React.useState(false);
  const [status, setStatus] = React.useState<GenStatus>(initialStatus);
  const [genError, setGenError] = React.useState<string | null>(initialError);
  /**
   * Аль генератор яг одоо ажиллаж байна вэ (`packshot` / `notes`).
   *
   * Ганц `busy` туг байсан нь хоёр картыг зэрэг түгждэг байв: нэгийг нь
   * дарахад нөгөө нь ч «Үүсгэж байна…» болж, хоёрдугаарыг эхлүүлэх боломжгүй.
   * Ажлууд сервер дээр бие биеэсээ хамааралгүй тул түгжээ нь ч тус тусдаа.
   */
  const [running, setRunning] = React.useState<string[]>([]);
  const [note, setNote] = React.useState<string | null>(null);
  // A product that already works from a reference opens on the AI side; every
  // other one opens on the plainer path.
  const [mode, setMode] = React.useState<AddMode>(
    aiEnabled && initialReference ? "ai" : "upload",
  );

  const fileRef = React.useRef<HTMLInputElement>(null);

  const { replaceImages, setPendingCounts } = gallery;
  /** Re-read the gallery: a finished job files its result as a row server-side. */
  const refreshGallery = React.useCallback(async () => {
    if (!productId) return;
    const r = await adminFetch<{ images?: GalleryImage[] }>(
      `/api/admin/products/${productId}/images`,
    );
    if (r.ok && r.data?.images) replaceImages(r.data.images);
  }, [productId, replaceImages]);

  /**
   * Ажлууд амьд байх хугацаанд л санал авна.
   *
   * «Хамгийн сүүлийн ажлын төлөв» (`status`) нь ганц ажилтай үед зөв байсан ч
   * ХОЁР ажил зэрэг явахад худал болно: хоёр дахь нь эхэлж дуусахад төлөв
   * `done` болж, санал авалт зогсоно — үлдсэн ажлын карт дундаасаа алга болж,
   * зураг нь зөвхөн дараагийн шинэчлэлтээр нэг дор гарч ирдэг байв. Тиймээс
   * «ажиллаж байна уу» гэдгийг АМЬД АЖЛЫН ТООгоор шийднэ.
   *
   * Эхний уншилт шууд явна: шинээр нэмсэн бараагаа жагсаалтаас нээхэд галерей
   * 4 секунд хоосон зогсох ёсгүй.
   */
  const [active, setActive] = React.useState(0);
  const activeRef = React.useRef(0);
  const polling = Boolean(productId) && (isBusy(status) || active > 0);

  React.useEffect(() => {
    if (!polling) return;
    let alive = true;
    const read = async () => {
      const r = await adminFetch<{
        statuses?: {
          status: GenStatus;
          error: string | null;
          generating?: number;
          queued?: number;
        }[];
      }>(`/api/admin/products/image-status?ids=${productId}`);
      const s = r.ok ? r.data?.statuses?.[0] : null;
      if (!s || !alive) return;
      setStatus(s.status);
      setGenError(s.error);

      const generating = s.generating ?? 0;
      const queued = s.queued ?? 0;
      const count = generating + queued;
      setPendingCounts(generating, queued);
      // Ажил дуусах бүрд шинэ зураг галерейд бичигдсэн байна — бүгдийг
      // хүлээхгүйгээр тэр даруй харуулна.
      if (count < activeRef.current) refreshGallery();
      activeRef.current = count;
      setActive(count);
      if (count === 0) {
        setRunning([]);
        refreshGallery();
      }
    };
    void read();
    const iv = setInterval(read, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [polling, productId, refreshGallery, setPendingCounts]);

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

  /**
   * Хоёр үндсэн зургийн аль нэгийг үүсгэнэ (packshot / үнэрийн нот).
   *
   * Prompt-ыг сервер өөрөө барина — энэ нь шинэ бараа үүсгэх үед автоматаар
   * ажилладаг яг тэр хоёр шат. Чөлөөт заавраар засах нь галерейн зураг дээр
   * дарахад гардаг цонхонд байна.
   */
  async function generate(kind: "packshot" | "notes") {
    if (!productId || running.includes(kind)) return;
    setRunning((r) => [...r, kind]);
    setNote(null);
    const res = await adminFetch(
      `/api/admin/products/${productId}/generate-image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      },
    );
    if (res.ok) {
      setStatus("generating");
      setGenError(null);
      gallery.startPending();
      return;
    }
    setRunning((r) => r.filter((k) => k !== kind));
    setNote(
      res.error.includes("NO_REFERENCE")
        ? "Эхлээд лавлах зураг оруулна уу."
        : res.error.includes("NO_NOTES")
          ? "Зурах боломжтой үнэрийн нот алга — барааны нот хоосон эсвэл бүгд хийсвэр."
          : res.error,
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="font-serif text-lg font-semibold">Зураг</h2>
          {polling ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              AI зураг үүсгэж байна…
            </span>
          ) : status === "failed" ? (
            <span className="text-destructive flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" />
              AI зураг амжилтгүй
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
                      "bg-muted text-muted-foreground relative block aspect-square w-28 overflow-hidden rounded-lg transition-colors",
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
                          Галерей-аас
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

                  {persisted ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {GENERATORS.map((gen) => (
                        <div
                          key={gen.kind}
                          className="bg-background flex flex-col gap-2 rounded-lg p-3"
                        >
                          <p className="text-sm font-medium">{gen.title}</p>
                          <p className="text-muted-foreground flex-1 text-xs">
                            {gen.description}
                          </p>
                          {/* Дүүргэсэн товч: картын дэвсгэр нь `bg-background`
                              бөгөөд хүрээний token ил тод (--border: transparent)
                              тул `outline` хувилбар нь картан дээр огт
                              ялгарахгүй байв. */}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => generate(gen.kind)}
                            disabled={running.includes(gen.kind)}
                          >
                            {running.includes(gen.kind) ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Үүсгэж байна…
                              </>
                            ) : (
                              <>
                                Үүсгэх
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
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
