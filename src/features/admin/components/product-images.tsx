"use client";

import * as React from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Trash2, UploadCloud, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
} from "@/lib/storage/limits";

/**
 * Product gallery editor (todo.md B3).
 *
 * Two modes, because a new product has no row to hang images on yet:
 *   • `productId` set — every change hits /api/admin/products/[id]/images
 *     immediately, so the admin can fix a gallery without re-saving the form.
 *   • `productId` omitted — images are uploaded to a staging folder and handed
 *     to the parent via `onChange`; the create route persists them.
 *
 * Order is the admin's to set (the first image is what the catalogue grid
 * shows), so tiles are dragged rather than nudged with buttons. Dragging uses
 * pointer events rather than HTML5 drag-and-drop so it works the same under a
 * finger on a tablet; the keyboard gets arrow keys on the focused handle.
 */

export interface GalleryImage {
  /** Absent until the row exists (new-product mode). */
  id?: string;
  url: string;
  alt: string;
}

const MAX_IMAGES = 12;

/**
 * The copy of the tile that rides under the pointer during a drag. Kept as a
 * separate fixed-position element rather than transforming the tile itself:
 * the tile is being re-slotted as the others shuffle, so anything anchored to
 * its layout position jumps around mid-drag.
 */
interface Ghost {
  url: string;
  width: number;
  height: number;
  /** Where inside the tile it was grabbed, so it doesn't snap to a corner. */
  grabX: number;
  grabY: number;
  /** Current pointer position. */
  x: number;
  y: number;
}

export function ProductImages({
  productId,
  initial = [],
  onChange,
}: {
  productId?: string;
  initial?: GalleryImage[];
  onChange?: (images: GalleryImage[]) => void;
}) {
  const [images, setImages] = React.useState<GalleryImage[]>(initial);
  const [uploading, setUploading] = React.useState(0);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [dropActive, setDropActive] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [ghost, setGhost] = React.useState<Ghost | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const inputRef = React.useRef<HTMLInputElement>(null);
  // The tiles are read off the list itself. An index-keyed ref array loses
  // entries as React re-attaches refs during a reorder — exactly when the
  // drag needs them.
  const listRef = React.useRef<HTMLUListElement>(null);
  // Pointer moves arrive faster than React re-renders, so a handler closure
  // can still hold the order (and position) from before the last swap. Both
  // live in refs; the state copies exist only to drive the styling.
  const imagesRef = React.useRef(images);
  const dragIndexRef = React.useRef<number | null>(null);

  const persisted = Boolean(productId);
  const full = images.length + uploading >= MAX_IMAGES;
  const dragging = dragIndex !== null;

  const notify = React.useCallback(
    (next: GalleryImage[]) => {
      imagesRef.current = next;
      setImages(next);
      onChange?.(next);
    },
    [onChange],
  );

  function addError(message: string) {
    setErrors((e) => (e.includes(message) ? e : [...e, message]));
  }

  /** Push the current order + alt text for an existing product. */
  const persistOrder = React.useCallback(
    async (next: GalleryImage[]) => {
      if (!persisted) return;
      await fetch(`/api/admin/products/${productId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: next
            .filter((img) => img.id)
            .map((img, i) => ({ id: img.id, alt: img.alt, sortOrder: i })),
        }),
      });
    },
    [persisted, productId],
  );

  // ── Upload ───────────────────────────────────────────────────────────
  async function upload(files: FileList | File[]) {
    setErrors([]);
    const room = MAX_IMAGES - imagesRef.current.length;
    if (room <= 0) {
      addError(`Хамгийн ихдээ ${MAX_IMAGES} зураг оруулна.`);
      return;
    }

    const picked = Array.from(files);
    if (picked.length > room) {
      addError(`Зөвхөн эхний ${room} зургийг авлаа (дээд хязгаар ${MAX_IMAGES}).`);
    }

    const accepted = picked.slice(0, room).filter((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        addError(`«${file.name}» — зөвхөн JPG / PNG / WebP / AVIF байна.`);
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        addError(`«${file.name}» — 5MB-аас том байна.`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    // Count them all up front so the placeholder tiles appear at once.
    setUploading((n) => n + accepted.length);
    for (const file of accepted) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        let res: Response;
        if (persisted) {
          res = await fetch(`/api/admin/products/${productId}/images`, {
            method: "POST",
            body: fd,
          });
        } else {
          fd.append("folder", "products/new");
          res = await fetch("/api/upload", { method: "POST", body: fd });
        }

        const data = await res.json().catch(() => null);
        if (data?.demo) {
          addError("Demo горим: зураг хадгалагдсангүй.");
        } else if (!res.ok || !data?.url) {
          addError(`«${file.name}» — оруулахад алдаа гарлаа.`);
        } else {
          // Append one at a time so each tile lands as soon as it's ready.
          notify([
            ...imagesRef.current,
            { id: data.id, url: data.url, alt: data.alt ?? "" },
          ]);
        }
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Reorder ──────────────────────────────────────────────────────────
  const tileIndexAt = React.useCallback((x: number, y: number) => {
    const tiles = listRef.current?.children;
    if (!tiles) return null;
    // Upload placeholders sit after the images and are not drop targets.
    const count = Math.min(tiles.length, imagesRef.current.length);
    for (let i = 0; i < count; i++) {
      const r = tiles[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }, []);

  const moveTo = React.useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= imagesRef.current.length || from === to) return;
      const next = [...imagesRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      notify(next);
    },
    [notify],
  );

  function startDrag(e: React.PointerEvent, index: number) {
    e.preventDefault();
    // Snapshot the tile so the floating copy is the same size and keeps the
    // exact spot inside it that was grabbed.
    const tile = listRef.current?.children[index] as HTMLElement | undefined;
    const r = tile?.getBoundingClientRect();
    if (r) {
      setGhost({
        url: imagesRef.current[index].url,
        width: r.width,
        height: r.height,
        grabX: e.clientX - r.left,
        grabY: e.clientY - r.top,
        x: e.clientX,
        y: e.clientY,
      });
    }
    dragIndexRef.current = index;
    setDragIndex(index);
  }

  /**
   * Tracked on the window rather than through setPointerCapture: reordering
   * moves the handle's tile in the DOM, and a captured element that is
   * re-inserted loses its capture — so the drag would stop after one swap.
   */
  React.useEffect(() => {
    if (!dragging) return;

    const move = (e: PointerEvent) => {
      const from = dragIndexRef.current;
      if (from === null) return;
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
      const over = tileIndexAt(e.clientX, e.clientY);
      if (over === null || over === from) return;
      moveTo(from, over);
      dragIndexRef.current = over;
      setDragIndex(over);
    };
    const end = () => {
      if (dragIndexRef.current === null) return;
      dragIndexRef.current = null;
      setDragIndex(null);
      setGhost(null);
      void persistOrder(imagesRef.current);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    // `dragging` only gates the binding; position comes from the ref, so a
    // swap mid-drag doesn't need to rebind.
  }, [dragging, moveTo, persistOrder, tileIndexAt]);

  function onHandleKeyDown(e: React.KeyboardEvent, index: number) {
    const delta =
      e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? -1
        : e.key === "ArrowRight" || e.key === "ArrowDown"
          ? 1
          : 0;
    if (!delta) return;
    e.preventDefault();
    moveTo(index, index + delta);
    void persistOrder(imagesRef.current);
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async function remove(index: number) {
    const img = images[index];
    const ok = await confirm({
      title: "Зургийг устгах уу?",
      description: "Зураг санд ч, барааны галерейд ч үлдэхгүй.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;

    if (persisted && img.id) {
      const res = await fetch(
        `/api/admin/products/${productId}/images?imageId=${img.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        addError("Устгахад алдаа гарлаа.");
        return;
      }
    }
    const next = images.filter((_, i) => i !== index);
    notify(next);
    await persistOrder(next);
  }

  function setAlt(index: number, alt: string) {
    notify(images.map((img, i) => (i === index ? { ...img, alt } : img)));
  }

  return (
    // select-none while dragging: otherwise the drag paints a text selection
    // across the tiles.
    <div className={`space-y-4 ${dragging ? "select-none" : ""}`}>
      {confirmDialog}

      {/* Dropzone — click or drop files anywhere inside it. A button so it
          answers to the keyboard as well as the mouse. */}
      <button
        type="button"
        disabled={full}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDropActive(true);
        }}
        onDragLeave={(e) => {
          // Ignore the events fired while crossing child elements.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDropActive(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropActive(false);
          if (!full && e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50 ${
          dropActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-secondary/40"
        }`}
      >
        <UploadCloud
          className={`size-7 ${dropActive ? "text-primary" : "text-muted-foreground"}`}
        />
        {/* Spans, not paragraphs: a <button> may only hold phrasing content. */}
        <span className="text-sm font-medium">
          {full
            ? `Дээд хязгаарт хүрсэн (${MAX_IMAGES} зураг)`
            : "Зургаа энд чирж оруулна уу"}
        </span>
        {!full && (
          <span className="text-xs text-muted-foreground">
            эсвэл дарж сонгоно уу · JPG / PNG / WebP / AVIF · 5MB хүртэл
          </span>
        )}
      </button>

      {/* Outside the dropzone: a click() on a child would bubble back into
          the button's onClick and reopen the picker forever. */}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.map((msg) => (
            <li key={msg} className="flex items-start gap-2">
              <span className="flex-1">{msg}</span>
              <button
                type="button"
                onClick={() => setErrors((e) => e.filter((m) => m !== msg))}
                aria-label="Мэдэгдлийг хаах"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(images.length > 0 || uploading > 0) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {images.length} / {MAX_IMAGES} зураг
          </span>
          {images.length > 1 && (
            <span className="hidden sm:inline">
              Чирж эрэмбийг солино · эхний зураг үндсэн зураг болно
            </span>
          )}
        </div>
      )}

      {images.length === 0 && uploading === 0 ? null : (
        <ul ref={listRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li
              key={img.id ?? img.url}
              className={`group relative overflow-hidden rounded-lg border bg-card transition-shadow ${
                dragIndex === i
                  ? // The tile stays as the empty slot the ghost will drop into.
                    "border-dashed border-primary opacity-30"
                  : "border-border"
              }`}
            >
              <div className="relative aspect-square bg-secondary">
                <Image
                  src={img.url}
                  alt={img.alt || "Барааны зураг"}
                  fill
                  sizes="(min-width: 640px) 200px, 45vw"
                  className="object-cover"
                  draggable={false}
                />

                {/* Drag handle: pointer events so touch works too. */}
                <button
                  type="button"
                  onPointerDown={(e) => startDrag(e, i)}
                  onKeyDown={(e) => onHandleKeyDown(e, i)}
                  aria-label={`${i + 1}-р зураг — чирж эрэмбэ солих (сум товчоор ч болно)`}
                  className="absolute left-1.5 top-1.5 touch-none rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 max-sm:opacity-100"
                  style={{ cursor: dragIndex === i ? "grabbing" : "grab" }}
                >
                  <GripVertical className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`${i + 1}-р зургийг устгах`}
                  className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 max-sm:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>

                {i === 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-1 text-center text-[11px] font-medium text-primary-foreground">
                    Үндсэн зураг
                  </span>
                )}
              </div>

              <Input
                value={img.alt}
                placeholder="Зургийн тайлбар (alt)"
                className="h-8 rounded-none border-0 border-t border-border bg-transparent text-xs"
                onChange={(e) => setAlt(i, e.target.value)}
                onBlur={() => persistOrder(imagesRef.current)}
              />
            </li>
          ))}

          {/* Placeholder per in-flight upload. */}
          {Array.from({ length: uploading }).map((_, i) => (
            <li
              key={`uploading-${i}`}
              className="flex aspect-square animate-pulse flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground"
            >
              <ImagePlus className="size-6" />
              <span className="text-xs">Оруулж байна…</span>
            </li>
          ))}
        </ul>
      )}

      {/* The image under the pointer. Fixed so no ancestor can clip it, and
          transparent to hit-testing so the tile beneath still answers. */}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden rounded-lg border-2 border-primary shadow-2xl"
          style={{
            width: ghost.width,
            height: ghost.height,
            left: 0,
            top: 0,
            transform: `translate(${ghost.x - ghost.grabX}px, ${ghost.y - ghost.grabY}px) rotate(-2deg)`,
          }}
        >
          {/* A plain img: next/image adds nothing for a copy of a picture the
              browser has already fetched. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ghost.url}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
