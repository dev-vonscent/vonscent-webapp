"use client";

import * as React from "react";
import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Trash2, UploadCloud, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";

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
 * shows), so tiles are dragged rather than nudged with buttons. Reordering is
 * dnd-kit sortable: pointer + touch via the handle, keyboard via the standard
 * space-pick / arrow-move / space-drop interaction on the same handle.
 */

export interface GalleryImage {
  /** Absent until the row exists (new-product mode). */
  id?: string;
  url: string;
  alt: string;
}

const MAX_IMAGES = 12;

/** Stable sortable id — DB id once the row exists, URL for staged uploads. */
function keyOf(img: GalleryImage): string {
  return img.id ?? img.url;
}

function SortableTile({
  img,
  index,
  onRemove,
  onAlt,
  onAltBlur,
}: {
  img: GalleryImage;
  index: number;
  onRemove: () => void;
  onAlt: (alt: string) => void;
  onAltBlur: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: keyOf(img) });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group bg-card relative overflow-hidden rounded-lg border ${
        isDragging
          ? // The tile stays as the empty slot the overlay will drop into.
            "border-primary border-dashed opacity-30"
          : "border-border"
      }`}
    >
      <div className="bg-secondary relative aspect-square">
        <Image
          src={img.url}
          alt={img.alt || "Барааны зураг"}
          fill
          sizes="(min-width: 640px) 200px, 45vw"
          className="object-cover"
          draggable={false}
        />

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${index + 1}-р зураг — чирж эрэмбэ солих (Space дараад сумаар зөөнө)`}
          className="bg-background/80 text-muted-foreground focus-visible:ring-ring absolute top-1.5 left-1.5 cursor-grab touch-none rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing max-sm:opacity-100"
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`${index + 1}-р зургийг устгах`}
          className="bg-background/80 text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute top-1.5 right-1.5 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none max-sm:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>

        {index === 0 && (
          <span className="bg-primary/90 text-primary-foreground absolute inset-x-0 bottom-0 py-1 text-center text-[11px] font-medium">
            Үндсэн зураг
          </span>
        )}
      </div>

      <Input
        value={img.alt}
        placeholder="Зургийн тайлбар (alt)"
        className="border-border h-8 rounded-none border-0 border-t bg-transparent text-xs"
        onChange={(e) => onAlt(e.target.value)}
        onBlur={onAltBlur}
      />
    </li>
  );
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
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const inputRef = React.useRef<HTMLInputElement>(null);
  // Uploads append sequentially while earlier responses may still be landing;
  // the ref always holds the latest list without waiting for a re-render.
  const imagesRef = React.useRef(images);

  const sensors = useSensors(
    // A small activation distance keeps a plain click on the handle from
    // starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persisted = Boolean(productId);
  const full = images.length + uploading >= MAX_IMAGES;
  const activeImage = activeId
    ? images.find((img) => keyOf(img) === activeId)
    : null;

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
      addError(
        `Зөвхөн эхний ${room} зургийг авлаа (дээд хязгаар ${MAX_IMAGES}).`,
      );
    }

    // Validate and downscale before any of them go up, so a rejected file is
    // reported without having left the browser.
    const accepted: File[] = [];
    for (const file of picked.slice(0, room)) {
      const prepared = await prepareUpload(file);
      if (prepared.ok) accepted.push(prepared.file);
      else addError(`«${file.name}» — ${prepared.message}`);
    }
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
  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = images.findIndex((img) => keyOf(img) === active.id);
    const to = images.findIndex((img) => keyOf(img) === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(images, from, to);
    notify(next);
    void persistOrder(next);
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
    <div className="space-y-4">
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
          if (!full && e.dataTransfer.files.length)
            upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`focus-visible:ring-ring flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-50 ${
          dropActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-secondary/40"
        }`}
      >
        <UploadCloud
          className={`size-7 ${dropActive ? "text-gold-strong" : "text-muted-foreground"}`}
        />
        {/* Spans, not paragraphs: a <button> may only hold phrasing content. */}
        <span className="text-sm font-medium">
          {full
            ? `Дээд хязгаарт хүрсэн (${MAX_IMAGES} зураг)`
            : "Зургаа энд чирж оруулна уу"}
        </span>
        {!full && (
          <span className="text-muted-foreground text-xs">
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
        <ul className="bg-destructive/10 text-destructive space-y-1 rounded-md px-3 py-2 text-sm">
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
        <div className="text-muted-foreground flex items-center justify-between text-xs">
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={images.map(keyOf)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img, i) => (
                <SortableTile
                  key={keyOf(img)}
                  img={img}
                  index={i}
                  onRemove={() => remove(i)}
                  onAlt={(alt) => setAlt(i, alt)}
                  onAltBlur={() => persistOrder(imagesRef.current)}
                />
              ))}

              {/* Placeholder per in-flight upload. */}
              {Array.from({ length: uploading }).map((_, i) => (
                <li
                  key={`uploading-${i}`}
                  className="border-border bg-secondary/50 text-muted-foreground flex aspect-square animate-pulse flex-col items-center justify-center gap-2 rounded-lg border border-dashed"
                >
                  <ImagePlus className="size-6" />
                  <span className="text-xs">Оруулж байна…</span>
                </li>
              ))}
            </ul>
          </SortableContext>

          {/* The image riding under the pointer. */}
          <DragOverlay>
            {activeImage ? (
              <div className="border-primary overflow-hidden rounded-lg border-2 shadow-2xl">
                {/* A plain img: next/image adds nothing for a copy of a picture
                    the browser has already fetched. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImage.url}
                  alt=""
                  className="size-full -rotate-2 object-cover"
                  draggable={false}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
