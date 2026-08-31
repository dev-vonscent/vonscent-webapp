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
import {
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  ImagePlus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  adminFetch,
  mutateJson,
  type AdminResult,
} from "@/features/admin/lib/mutate";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";

/**
 * Product gallery editor (todo.md B3), split into a controller and two views.
 *
 * It used to be one component that always drew the dropzone above the tiles.
 * The image studio needs them apart — the pictures read first, and adding one
 * is a choice between uploading and generating — so the state lives in
 * `useProductGallery` and the caller places `GalleryGrid` and `GalleryDropzone`
 * where they belong.
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
  /**
   * Whether the storefront shows it (0049). Every picture — uploaded or
   * AI-generated — is a gallery row; this is the admin's selection among them.
   * Uploads arrive selected, generated images arrive waiting to be picked.
   */
  visible: boolean;
}

export const MAX_IMAGES = 12;

/** Stable sortable id — DB id once the row exists, URL for staged uploads. */
function keyOf(img: GalleryImage): string {
  return img.id ?? img.url;
}

export interface GalleryController {
  images: GalleryImage[];
  uploading: number;
  errors: string[];
  full: boolean;
  dismissError: (message: string) => void;
  upload: (files: FileList | File[]) => Promise<void>;
  /** Re-seed from the server — a background job may have filed a new row. */
  replaceImages: (images: GalleryImage[]) => void;
  remove: (index: number) => Promise<void>;
  setAlt: (index: number, alt: string) => void;
  toggleVisible: (index: number) => void;
  /** How many pictures the storefront actually shows. */
  visibleCount: number;
  persistCurrent: () => void;
  confirmDialog: React.ReactNode;
  dnd: {
    sensors: ReturnType<typeof useSensors>;
    activeImage: GalleryImage | null;
    onDragStart: (e: DragStartEvent) => void;
    onDragEnd: (e: DragEndEvent) => void;
    onDragCancel: () => void;
  };
}

export function useProductGallery({
  productId,
  initial = [],
  onChange,
}: {
  productId?: string;
  initial?: GalleryImage[];
  onChange?: (images: GalleryImage[]) => void;
}): GalleryController {
  const [images, setImages] = React.useState<GalleryImage[]>(initial);
  const [uploading, setUploading] = React.useState(0);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  // Uploads append sequentially while earlier responses may still be landing;
  // the ref always holds the latest list without waiting for a re-render.
  const imagesRef = React.useRef(images);

  const sensors = useSensors(
    // A small activation distance keeps a plain click on the handle from
    // starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persisted = Boolean(productId);
  const full = images.length + uploading >= MAX_IMAGES;

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
      await mutateJson(
        `/api/admin/products/${productId}/images`,
        "PATCH",
        {
          images: next
            .filter((img) => img.id)
            .map((img, i) => ({
            id: img.id,
            alt: img.alt,
            sortOrder: i,
            isVisible: img.visible,
          })),
        },
        "Зургийн дараалал хадгалагдсангүй",
      );
    },
    [persisted, productId],
  );

  // Upload
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
        let res: AdminResult<{
          url?: string;
          id?: string;
          alt?: string | null;
        }>;
        if (persisted) {
          res = await adminFetch<{
            url?: string;
            id?: string;
            alt?: string | null;
          }>(`/api/admin/products/${productId}/images`, {
            method: "POST",
            body: fd,
          });
        } else {
          fd.append("folder", "products/new");
          res = await adminFetch<{
            url?: string;
            id?: string;
            alt?: string | null;
          }>("/api/upload", {
            method: "POST",
            body: fd,
          });
        }

        const data = res.ok ? res.data : null;
        if (!res.ok) {
          addError(
            res.demo
              ? "Demo горим: зураг хадгалагдсангүй."
              : `«${file.name}» — ${res.error}`,
          );
        } else if (!data?.url) {
          addError(`«${file.name}» — оруулахад алдаа гарлаа.`);
        } else {
          // Append one at a time so each tile lands as soon as it's ready.
          notify([
            ...imagesRef.current,
            { id: data.id, url: data.url, alt: data.alt ?? "", visible: true },
          ]);
        }
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  // Delete
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
      const res = await adminFetch(
        `/api/admin/products/${productId}/images?imageId=${img.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        addError(res.error);
        return;
      }
    }
    const next = images.filter((_, i) => i !== index);
    notify(next);
    await persistOrder(next);
  }

  return {
    images,
    uploading,
    errors,
    full,
    dismissError: (message) =>
      setErrors((e) => e.filter((m) => m !== message)),
    upload,
    replaceImages: notify,
    remove,
    setAlt: (index, alt) =>
      notify(images.map((img, i) => (i === index ? { ...img, alt } : img))),
    toggleVisible: (index) => {
      const next = images.map((img, i) =>
        i === index ? { ...img, visible: !img.visible } : img,
      );
      notify(next);
      void persistOrder(next);
    },
    visibleCount: images.filter((img) => img.visible).length,
    persistCurrent: () => void persistOrder(imagesRef.current),
    confirmDialog,
    dnd: {
      sensors,
      activeImage: activeId
        ? (images.find((img) => keyOf(img) === activeId) ?? null)
        : null,
      onDragStart: (e) => setActiveId(String(e.active.id)),
      onDragEnd: (e) => {
        setActiveId(null);
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const from = images.findIndex((img) => keyOf(img) === active.id);
        const to = images.findIndex((img) => keyOf(img) === over.id);
        if (from < 0 || to < 0) return;
        const next = arrayMove(images, from, to);
        notify(next);
        void persistOrder(next);
      },
      onDragCancel: () => setActiveId(null),
    },
  };
}

function SortableTile({
  img,
  index,
  isPrimary,
  eager,
  onRemove,
  onAlt,
  onAltBlur,
  onToggleVisible,
}: {
  img: GalleryImage;
  index: number;
  /** First *visible* image — the one the catalogue grid shows. */
  isPrimary: boolean;
  /** Above the fold now that the gallery leads the form — load it eagerly. */
  eager: boolean;
  onRemove: () => void;
  onAlt: (alt: string) => void;
  onAltBlur: () => void;
  onToggleVisible: () => void;
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
      className={`group bg-card relative overflow-hidden rounded-lg ${
        isDragging
          ? // The tile stays as the empty slot the overlay will drop into.
            "opacity-30"
          : ""
      }`}
    >
      <div className="bg-secondary relative aspect-square">
        <Image
          src={img.url}
          alt={img.alt || "Барааны зураг"}
          fill
          sizes="(min-width: 640px) 200px, 45vw"
          priority={eager}
          // A picture the shop does not show reads as a draft, not as a
          // missing one: still legible, plainly set aside.
          className={`object-cover transition-opacity ${img.visible ? "" : "opacity-35"}`}
          draggable={false}
        />

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${index + 1}-р зураг — чирж эрэмбэ солих (Space дараад сумаар зөөнө)`}
          className="on-image text-muted-foreground absolute top-1.5 left-1.5 cursor-grab touch-none rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing max-sm:opacity-100"
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`${index + 1}-р зургийг устгах`}
          className="on-image text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>

        {/* The selection itself. Always visible — it is the decision this
            grid exists to record, not a hover affordance. */}
        <button
          type="button"
          onClick={onToggleVisible}
          aria-pressed={img.visible}
          className="on-image absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium"
        >
          {img.visible ? (
            <>
              <Eye className="text-gold-strong size-3.5" />
              {isPrimary ? "Үндсэн зураг" : "Сайтад харагдана"}
            </>
          ) : (
            <>
              <EyeOff className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground">Харагдахгүй</span>
            </>
          )}
        </button>
      </div>

      <Input
        value={img.alt}
        placeholder="Зургийн тайлбар (alt)"
        className="bg-secondary/60 h-11 rounded-none text-base md:h-9 md:text-xs"
        onChange={(e) => onAlt(e.target.value)}
        onBlur={onAltBlur}
      />
    </li>
  );
}

/** The pictures themselves — first in the studio, above the add controls. */
export function GalleryGrid({ g }: { g: GalleryController }) {
  if (g.images.length === 0 && g.uploading === 0) {
    return (
      <>
        {g.confirmDialog}
        <div className="bg-secondary/40 text-muted-foreground flex flex-col items-center gap-2 rounded-xl px-4 py-10 text-center">
          <ImageIcon className="size-6" />
          <p className="text-sm">Зураг алга</p>
          <p className="text-xs">
            Доорх «Зураг нэмэх» хэсгээс оруулах эсвэл AI-аар үүсгэнэ.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {g.confirmDialog}
      <DndContext
        // dnd-kit derives `aria-describedby="DndDescribedBy-<id>"` from a
        // module-level counter when no id is given. The server module is long
        // lived, so its counter drifts past the client's and every tile
        // hydrates with a mismatched attribute. A fixed id pins both sides.
        id="product-gallery"
        sensors={g.dnd.sensors}
        collisionDetection={closestCenter}
        onDragStart={g.dnd.onDragStart}
        onDragEnd={g.dnd.onDragEnd}
        onDragCancel={g.dnd.onDragCancel}
      >
        <SortableContext
          items={g.images.map(keyOf)}
          strategy={rectSortingStrategy}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.images.map((img, i) => (
              <SortableTile
                key={keyOf(img)}
                img={img}
                index={i}
                eager={i === 0}
                isPrimary={
                  img.visible && g.images.findIndex((x) => x.visible) === i
                }
                onRemove={() => g.remove(i)}
                onAlt={(alt) => g.setAlt(i, alt)}
                onAltBlur={g.persistCurrent}
                onToggleVisible={() => g.toggleVisible(i)}
              />
            ))}

            {/* Placeholder per in-flight upload. */}
            {Array.from({ length: g.uploading }).map((_, i) => (
              <li
                key={`uploading-${i}`}
                className="bg-secondary/50 text-muted-foreground flex aspect-square animate-pulse flex-col items-center justify-center gap-2 rounded-lg"
              >
                <ImagePlus className="size-6" />
                <span className="text-xs">Оруулж байна…</span>
              </li>
            ))}
          </ul>
        </SortableContext>

        {/* The image riding under the pointer. */}
        <DragOverlay>
          {g.dnd.activeImage ? (
            <div className="overflow-hidden rounded-lg shadow-2xl">
              {/* A plain img: next/image adds nothing for a copy of a picture
                  the browser has already fetched. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.dnd.activeImage.url}
                alt=""
                className="size-full -rotate-2 object-cover"
                draggable={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

/** Click or drop files. Lives inside the studio's «Бэлэн зураг» tab. */
export function GalleryDropzone({ g }: { g: GalleryController }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = React.useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={g.full}
        onDragOver={(e) => {
          e.preventDefault();
          if (!g.full) setDropActive(true);
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
          if (!g.full && e.dataTransfer.files.length) g.upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`field-edge flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg px-4 py-7 text-center transition-colors disabled:cursor-default disabled:opacity-50 ${
          dropActive ? "bg-accent" : "hover:bg-accent/60"
        }`}
      >
        <UploadCloud
          className={`size-6 ${dropActive ? "text-gold-strong" : "text-muted-foreground"}`}
        />
        {/* Spans, not paragraphs: a <button> may only hold phrasing content. */}
        <span className="text-sm font-medium">
          {g.full
            ? `Дээд хязгаарт хүрсэн (${MAX_IMAGES} зураг)`
            : "Зургаа энд чирж оруулна уу"}
        </span>
        {!g.full && (
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
        onChange={(e) => {
          if (e.target.files) g.upload(e.target.files);
          e.target.value = "";
        }}
      />

      {g.errors.length > 0 && (
        <ul className="bg-destructive/10 text-destructive space-y-1 rounded-md px-3 py-2 text-sm">
          {g.errors.map((msg) => (
            <li key={msg} className="flex items-start gap-2">
              <span className="flex-1">{msg}</span>
              <button
                type="button"
                onClick={() => g.dismissError(msg)}
                aria-label="Мэдэгдлийг хаах"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
