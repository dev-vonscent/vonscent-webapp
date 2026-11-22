"use client";

import * as React from "react";
import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { uploadErrorMessage, xhrUpload } from "@/lib/storage/upload-progress";
import { UploadProgress } from "@/features/admin/components/upload-progress";
import { EXTRA_IMAGES_MAX } from "@/lib/validators/extras";
import { cn } from "@/lib/utils";

/**
 * Нэмэлт барааны зургууд (4:5 — дэлгүүрийн карттай ижил харьцаа).
 * Эхний зураг нь картын зураг; зургийг чирж дараалал солино (dnd-kit —
 * хулгана, утсан дээр удаан дарж, гараар бариулаас Space + сум). Хоосон байж болно
 * (үлдэгдэлтэй шил эх үнэртнийхээ зургийг авна).
 */
export function ExtraImagesField({
  value,
  onChange,
  max = EXTRA_IMAGES_MAX,
  gridClassName,
  fill = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Хувилбарын ганц зураг г.м. */
  max?: number;
  /** Баганын тоо — байрлах газрын өргөнд тааруулна. */
  gridClassName?: string;
  /**
   * Ганц tile эцгийнхээ өндрийг дүүргэнэ (4:5 биш) — хувилбарын мөрөнд хоёр
   * input-ийн өндөртэй тэнцүү. `max={1}`-тэй хамт.
   */
  fill?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  async function upload(file: File) {
    setError(null);
    const prepared = await prepareUpload(file);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", prepared.file);
      fd.append("folder", "extras");
      const res = await xhrUpload<{ url?: string; demo?: boolean }>({
        url: "/api/upload",
        body: fd,
        onProgress: (pct) => setProgress(pct < 100 ? pct : null),
      });
      if (res.status < 200 || res.status >= 300 || res.json?.demo) {
        setError(uploadErrorMessage(res, "Зураг байршуулж чадсангүй"));
      } else if (!res.json?.url) {
        setError("Оруулахад алдаа гарлаа.");
      } else {
        onChange([...value, res.json.url]);
      }
    } catch {
      setError("Сүлжээний алдаа — дахин оролдоно уу.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const dndId = React.useId();
  const [dragging, setDragging] = React.useState<string | null>(null);
  const sensors = useSensors(
    // Бага зай — хасах товч дээрх энгийн дарилт чирэлт эхлүүлэхгүй.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Утсан дээр удаан дарж чирнэ — хуудас гүйлгэх хөдөлгөөн хэвээр.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = value.indexOf(String(active.id));
    const to = value.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(value, from, to));
  }

  return (
    <div className={fill ? "flex h-full flex-col gap-1.5" : "space-y-1.5"}>
      {/* Ганц зураг (хувилбарын) — нарийн баганад ч бүтэн өргөнөөр. */}
      <ul
        className={cn(
          "grid gap-2",
          fill && "min-h-0 flex-1",
          gridClassName ??
            (max === 1 ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-4"),
        )}
      >
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setDragging(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <SortableContext items={value} strategy={rectSortingStrategy}>
            {value.map((url, i) => (
              <SortableImage
                key={url}
                url={url}
                index={i}
                sortable={value.length > 1}
                fill={fill}
                onRemove={() => onChange(value.filter((u) => u !== url))}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {dragging ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dragging}
                alt=""
                className="aspect-4/5 size-full -rotate-2 rounded-lg object-cover shadow-2xl"
                draggable={false}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        {!full && (
          <li className={cn(fill && "h-full")}>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "border-muted-foreground/40 bg-secondary text-muted-foreground hover:border-muted-foreground/70 hover:bg-accent flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors disabled:opacity-60",
                fill ? "h-full" : "aspect-4/5",
              )}
            >
              {busy ? (
                <UploadProgress pct={progress} />
              ) : (
                <>
                  <ImagePlus className="size-5" aria-hidden />
                  Зураг нэмэх
                </>
              )}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function SortableImage({
  url,
  index,
  sortable,
  onRemove,
  fill,
}: {
  url: string;
  index: number;
  fill: boolean;
  /** Ганц зурагтай үед чирэх юм алга — бариул нуугдана. */
  sortable: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url, disabled: !sortable });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Зураг бүхэлдээ чирэгдэнэ; гарын дарааллыг бариул (attributes) авна.
      {...listeners}
      className={cn(
        "group bg-secondary relative overflow-hidden rounded-lg",
        fill ? "h-full" : "aspect-4/5",
        sortable && "cursor-grab active:cursor-grabbing",
        // Overlay доор унах хоосон байр.
        isDragging && "opacity-30",
      )}
    >
      <Image
        src={url}
        alt=""
        fill
        sizes="120px"
        className="object-cover"
        draggable={false}
      />
      {index === 0 && (
        <span className="bg-background/85 absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
          Нүүр зураг
        </span>
      )}
      {sortable && (
        <button
          type="button"
          {...attributes}
          aria-label={`${index + 1}-р зураг — чирж байрлал солих (Space дараад сумаар зөөнө)`}
          // Үнэртний галерейтай ижил (product-images.tsx): hover-т гарна,
          // утсан дээр (hover байхгүй) үргэлж.
          className="on-image text-muted-foreground absolute top-1.5 left-1.5 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        // Хасах дарилт (хулгана, хуруу, Enter/Space) чирэлт эхлүүлэхгүй —
        // мэдрэгчүүд li дээр сонсдог.
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="on-image text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
        aria-label={`${index + 1}-р зургийг устгах`}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
