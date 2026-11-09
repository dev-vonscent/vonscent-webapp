"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Crown,
  GripVertical,
  HeartCrack,
  Lightbulb,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Settings2,
  Ticket,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SpinPrizeKind, SpinWheelPrizeRow } from "@/db/types";
import type { GrandBundleChoice, WheelSettings } from "@/features/admin/api";
import type { ProductOption } from "@/features/admin/lib/product-option";
import {
  KIND_LABEL,
  KIND_ORDER,
  TIER_LABEL,
  blankDraft,
  nominalWorth,
  prizeDetail,
  toDraft,
  toPayload,
  type PrizeDraft,
} from "@/features/admin/lib/wheel-prizes";
import { WheelPrizeDialog } from "./wheel-prize-dialog";
import { MissTipsDialog, WheelSettingsDialog } from "./wheel-settings-dialog";

/**
 * Азын хүрдний шагналууд (0170) — хүснэгт дарааллаараа (1 = дээд нүд, цагийн
 * зүүний дагуу). Бариулаар чирж байрлал солино; мөр бүрийн «⋯»: засах,
 * устгах; нэмэх, засах нь popup. Үйлдэл бүр шууд хадгалагдана (бүтэн жагсаалт
 * нэг transaction-д).
 */

const KIND_ICON: Record<
  SpinPrizeKind,
  React.ComponentType<{ className?: string }>
> = {
  none: HeartCrack,
  points: VPointIcon,
  coupon_percent: Ticket,
  coupon_fixed: Ticket,
  product: Package,
  bundle: Crown,
};

/** Menu rows tall enough for a finger on a phone. */
const ITEM = "min-h-11 md:min-h-0";

const pct = (n: number) =>
  `${n.toLocaleString("mn-MN", { maximumFractionDigits: 2 })}%`;

export function LuckyWheelAdmin({
  prizes,
  settings,
  bundleChoices,
  productOptions,
}: {
  prizes: SpinWheelPrizeRow[];
  settings: WheelSettings;
  bundleChoices: GrandBundleChoice[];
  productOptions: ProductOption[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = React.useState(false);
  /** The prize open in the popup: its index, or null for a new one. */
  const [editing, setEditing] = React.useState<{
    index: number | null;
    draft: PrizeDraft;
  } | null>(null);
  const [dialog, setDialog] = React.useState<"settings" | "tips" | null>(null);
  /**
   * The order just dragged into place — shown until the server's rows replace
   * `prizes` (a new array after the refresh), so nothing jumps back meanwhile.
   */
  const [ordered, setOrdered] = React.useState<{
    base: SpinWheelPrizeRow[];
    rows: SpinWheelPrizeRow[];
  } | null>(null);
  const rows = ordered?.base === prizes ? ordered.rows : prizes;

  const weights = prizes.map((p) => Number(p.weight));
  const total = weights.reduce((s, w) => s + w, 0);
  const prizeShare = prizes
    .filter((p) => p.kind !== "none")
    .reduce((s, p) => s + Number(p.weight), 0);
  const off = Math.abs(total - 100) > 0.001;
  const priceOf = (p: SpinWheelPrizeRow) =>
    (p.product_id &&
      p.ml &&
      productOptions.find((o) => o.id === p.product_id)?.priceByMl[p.ml]) ||
    0;
  const perSpin =
    total > 0
      ? prizes.reduce(
          (s, p) =>
            s + (Number(p.weight) / total) * nominalWorth(p, priceOf(p)),
          0,
        )
      : 0;
  const needsBundles =
    prizes.some((p) => p.kind === "bundle") &&
    (!settings.grandBundles.male || !settings.grandBundles.female);

  /** Save the whole wheel; true on success. */
  async function persist(next: PrizeDraft[], done: string) {
    setBusy(true);
    const ok = await mutateJson(
      "/api/admin/lucky-wheel",
      "PUT",
      { prizes: next.map(toPayload) },
      "Хадгалж чадсангүй",
    );
    setBusy(false);
    if (ok) {
      toast.success(done);
      router.refresh();
    }
    return ok;
  }

  const drafts = () => rows.map(toDraft);

  const sensors = useSensors(
    // A few pixels before a drag starts — a tap on the handle stays a tap.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((p) => p.id === active.id);
    const to = rows.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(rows, from, to);
    // Shown at once; the server's order replaces it after the save (or the
    // old one comes back if the save fails).
    setOrdered({ base: prizes, rows: next });
    if (!(await persist(next.map(toDraft), "Байрлал солигдлоо"))) {
      setOrdered(null);
    }
  }

  async function remove(index: number) {
    const p = rows[index];
    const ok = await confirm({
      title: "Шагнал устгах уу?",
      description: `«${p.label}» хүрднээс хасагдана. Өмнө хожсон түүх хэвээр үлдэнэ. Магадлалын нийлбэрийг 100 болгохоо мартуузай.`,
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    void persist(
      drafts().filter((_, i) => i !== index),
      "Шагнал устгагдлаа",
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}

      {/* ── Нийлбэр ба үйлдлүүд ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground mr-auto text-sm">
          <span
            className={cn(
              "font-semibold tabular-nums",
              off ? "text-destructive" : "text-foreground",
            )}
          >
            Нийт {pct(total)}
          </span>{" "}
          · шагнал {pct(prizeShare)} · хоосон {pct(total - prizeShare)} ·{" "}
          {prizes.length} нүд · дундаж {formatPrice(Math.round(perSpin))} /
          эргэлт
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialog("tips")}
        >
          <Lightbulb className="size-4" />
          Зөвлөгөө ({settings.missTips.length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialog("settings")}
        >
          <Settings2 className="size-4" />
          Тохиргоо
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={busy || prizes.length >= 40}>
              <Plus className="size-4" />
              Шагнал нэмэх
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {KIND_ORDER.map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <DropdownMenuItem
                  key={k}
                  className={ITEM}
                  // Let the menu hand focus back before the popup takes it.
                  onSelect={() =>
                    requestAnimationFrame(() =>
                      setEditing({ index: null, draft: blankDraft(k) }),
                    )
                  }
                >
                  <Icon />
                  {KIND_LABEL[k]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {off && (
        <p className="text-destructive text-xs">
          Магадлалын нийлбэр 100% биш байна — хүрд нийлбэрээс нь харьцангуйгаар
          сугалах тул ажиллана, гэхдээ хүснэгтийн хувь бодит магадлалаас зөрнө.
        </p>
      )}
      {needsBundles && (
        <p className="text-destructive text-xs">
          Гранд шагналын эрэгтэй, эмэгтэй 2мл багцыг «Тохиргоо»-ноос сонгоно уу
          — эс бөгөөс хожсон хэрэглэгч сонгох юмгүй үлдэнэ.
        </p>
      )}

      {/* ── Хүснэгт ───────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <div className="text-muted-foreground hidden grid-cols-[3.25rem_minmax(0,1fr)_6rem_6rem_5rem_2.5rem] items-center gap-3 border-b py-2.5 pr-4 pl-2 text-xs font-medium md:grid">
            <span>#</span>
            <span>Шагнал</span>
            <span>Зэрэглэл</span>
            <span className="text-right">Магадлал</span>
            <span className="text-right">Нэг удаа</span>
            <span />
          </div>
          <DndContext
            // Fixed id: dnd-kit's generated one drifts between server and
            // client and breaks hydration (product-images.tsx).
            id="wheel-prizes"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rows.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
          <ol className="divide-muted/60 divide-y">
            {rows.map((p, i) => (
              <PrizeRow
                key={p.id}
                prize={p}
                index={i}
                share={total > 0 ? (Number(p.weight) / total) * 100 : 0}
                busy={busy}
                canDelete={rows.length > 2}
                onEdit={() =>
                  requestAnimationFrame(() =>
                    setEditing({ index: i, draft: toDraft(p) }),
                  )
                }
                onDelete={() => requestAnimationFrame(() => void remove(i))}
              />
            ))}
          </ol>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {editing && (
        <WheelPrizeDialog
          // A fresh form per opening — never yesterday's half-typed draft.
          key={editing.index ?? "new"}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          initial={editing.draft}
          productOptions={productOptions}
          onSave={(draft) => {
            const next = drafts();
            if (editing.index === null) next.push(draft);
            else next[editing.index] = draft;
            return persist(
              next,
              editing.index === null ? "Шагнал нэмэгдлээ" : "Шагнал хадгалагдлаа",
            );
          }}
        />
      )}
      {dialog === "settings" && (
        <WheelSettingsDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          settings={settings}
          bundleChoices={bundleChoices}
        />
      )}
      {dialog === "tips" && (
        <MissTipsDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          settings={settings}
        />
      )}
    </div>
  );
}

/** One wedge in the table — dragged by its grip, edited from its «⋯». */
function PrizeRow({
  prize: p,
  index,
  share,
  busy,
  canDelete,
  onEdit,
  onDelete,
}: {
  prize: SpinWheelPrizeRow;
  index: number;
  /** Real chance in percent (weight over the total). */
  share: number;
  busy: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: p.id, disabled: busy });
  const Icon = KIND_ICON[p.kind];
  const none = p.kind === "none";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card relative grid grid-cols-[2.75rem_minmax(0,1fr)_auto_2.5rem] items-center gap-3 py-2.5 pr-4 pl-1 md:grid-cols-[3.25rem_minmax(0,1fr)_6rem_6rem_5rem_2.5rem]",
        none && "text-muted-foreground",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${index + 1}-р нүд «${p.label}» — чирж байрлал солих (Space дараад сумаар зөөнө)`}
        className="text-muted-foreground hover:text-foreground flex cursor-grab touch-none items-center gap-0.5 rounded-md py-1.5 pl-1 active:cursor-grabbing disabled:cursor-default"
        disabled={busy}
      >
        <GripVertical className="size-4 shrink-0" />
        <span className="text-xs tabular-nums">{index + 1}</span>
      </button>
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="text-muted-foreground size-4 shrink-0" />
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm",
              !none && "text-foreground font-medium",
            )}
          >
            {p.label}
          </p>
          {!none && (
            <p className="text-muted-foreground truncate text-xs">
              {prizeDetail(p)}
            </p>
          )}
        </div>
      </div>
      <span className="hidden md:block">
        {!none && (
          <Badge variant={p.tier === "grand" ? "gold" : "secondary"}>
            {TIER_LABEL[p.tier]}
          </Badge>
        )}
      </span>
      <span className="text-right text-sm font-semibold tabular-nums">
        {pct(Number(p.weight))}
      </span>
      <span className="text-muted-foreground hidden text-right text-xs tabular-nums md:block">
        {share > 0 ? `1 : ${Math.round(100 / share)}` : "—"}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`${p.label} — үйлдэл`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className={ITEM} onSelect={onEdit}>
            <Pencil />
            Засах
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn(ITEM, "text-destructive")}
            disabled={!canDelete}
            onSelect={onDelete}
          >
            <Trash2 />
            Устгах
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
