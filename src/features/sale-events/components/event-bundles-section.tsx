"use client";

import * as React from "react";
import { Check, Lock, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ML_SIZES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BUNDLE_STATUS_LABEL,
  bundleIssue,
  bundleLock,
  bundleSizePreview,
  type SaleEventBundleOption,
  type StudioBundle,
} from "../bundles";
import { PctInput } from "./event-items-section";

/** Хүснэгтийн багана: багц · 4 хэмжээ · хасах (барааны хүснэгттэй ижил). */
const GRID =
  "grid grid-cols-[minmax(9rem,1fr)_repeat(4,minmax(5.75rem,7.5rem))_2.25rem] items-center gap-x-2";

/**
 * Бэлэн багц + хэмжээ бүрийн event хувь (task 16.7, туг `sale_event_bundles`).
 * Хэмжээ бүрт багцын ОДООГИЙН хувийг харуулж, админ шинэ хувь бичнэ — event
 * хувь суурийг ОРЛОНО (нэмэгдэхгүй), одоогийнхоос их байх ёстой. Хоосон
 * хэмжээ = суурь хувиараа үлдэнэ. 16.3: хугацаа давхцсан нийтэлсэн арга
 * хэмжээнд орсон багц сонгогчид disabled + аль event-д байгааг харуулна;
 * ноорогт орсныг мэдээлэл болгоно (барааны дүрэмтэй ижил — ноорог түгжихгүй).
 */
export function EventBundlesSection({
  bundles,
  options,
  eventId,
  period,
  now,
  step,
  onChange,
}: {
  bundles: StudioBundle[];
  options: readonly SaleEventBundleOption[];
  eventId: string | null;
  /** Энэ ноорогийн хугацаа (ISO); сонгоогүй бол null. */
  period: { startsAt: string | null; endsAt: string | null };
  now: number;
  /** Багцын үнийн тэгшлэл (`settings.collection.roundTo`). */
  step: number;
  onChange: (bundles: StudioBundle[]) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const byId = React.useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options],
  );
  const lockOf = (o: SaleEventBundleOption) =>
    bundleLock(o, { eventId, ...period, now });

  function setPct(collectionId: string, ml: number, value: string) {
    onChange(
      bundles.map((b) =>
        b.collectionId === collectionId
          ? { ...b, pcts: { ...b.pcts, [ml]: value } }
          : b,
      ),
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="event-bundles-title">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-60">
          <h3 id="event-bundles-title" className="text-sm font-medium">
            Бэлэн багц{" "}
            <span className="text-muted-foreground tabular-nums">
              · {bundles.length}
            </span>
          </h3>
          <p className="text-muted-foreground text-xs text-pretty">
            Хэмжээ бүрт бичсэн хувь багцын одоогийн хувийг орлоно. Арга хэмжээ
            дуусахад өмнөх хувь руугаа өөрөө буцна.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
        >
          <Plus />
          Багц нэмэх
        </Button>
      </div>

      {bundles.length > 0 && (
        <div className="bg-card overflow-x-auto rounded-lg">
          <div
            role="table"
            aria-label="Хямдрах багц"
            className="min-w-152 p-1.5"
          >
            <div
              role="row"
              className={cn(
                GRID,
                "text-muted-foreground bg-secondary/50 rounded-md px-2.5 py-2 text-xs",
              )}
            >
              <span role="columnheader" className="font-medium">
                Багц
              </span>
              {ML_SIZES.map((ml) => (
                <span role="columnheader" key={ml} className="font-medium">
                  {ml}ml
                </span>
              ))}
              <span role="columnheader" className="sr-only">
                Хасах
              </span>
            </div>
            <div role="rowgroup">
              {bundles.map((b) => {
                const o = byId.get(b.collectionId);
                const issue = bundleIssue(b, o);
                const locked = o ? lockOf(o).locked : null;
                return (
                  <div
                    role="row"
                    key={b.collectionId}
                    className={cn(
                      GRID,
                      "rounded-md px-2.5 py-2",
                      locked ? "bg-destructive/10" : "hover:bg-secondary/40",
                    )}
                  >
                    <div role="cell" className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">
                          {o?.name ?? "Нуусан / устгасан багц"}
                        </span>
                        {/* Event-д орсны дараа дууссан / идэвхгүй болсон —
                            хадгалахад хэвээр үлдэнэ, хасах нь админы шийдвэр. */}
                        {o && o.status !== "available" && (
                          <span className="bg-secondary text-muted-foreground shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-normal">
                            {BUNDLE_STATUS_LABEL[o.status]}
                          </span>
                        )}
                      </p>
                      {(locked || issue) && (
                        <p className="text-destructive text-xs text-pretty">
                          {locked
                            ? `«${locked.name}» арга хэмжээнд давхцсан`
                            : issue}
                        </p>
                      )}
                    </div>
                    {ML_SIZES.map((ml) => {
                      const raw = b.pcts[ml] ?? "";
                      const preview = o
                        ? bundleSizePreview(o, ml, raw, step)
                        : null;
                      if (!o || !preview) {
                        return (
                          <span
                            role="cell"
                            key={ml}
                            className="text-muted-foreground/60 pl-3 text-sm"
                            aria-label={`${ml}ml байхгүй`}
                          >
                            —
                          </span>
                        );
                      }
                      const base = o.basePcts[ml] ?? 0;
                      const filled = raw.trim() !== "";
                      const low = filled && Number(raw) <= base;
                      return (
                        <div role="cell" key={ml} className="space-y-1">
                          <PctInput
                            value={raw}
                            invalid={filled && (low || preview.next == null)}
                            aria-label={`${o.name} ${ml}ml хувь (одоо ${base}%)`}
                            onChange={(v) => setPct(b.collectionId, ml, v)}
                          />
                          <p className="text-muted-foreground text-[11px] leading-tight">
                            Одоо {base}%
                          </p>
                          <p className="truncate text-[11px] leading-tight tabular-nums">
                            {preview.next != null && !low ? (
                              <>
                                <span className="font-medium">
                                  {formatPrice(preview.next)}
                                </span>{" "}
                                <span className="text-muted-foreground line-through">
                                  {formatPrice(preview.current)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {formatPrice(preview.current)}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                    <div role="cell">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-9 rounded-full"
                        aria-label={`${o?.name ?? "Багц"}-ыг хасах`}
                        onClick={() =>
                          onChange(
                            bundles.filter(
                              (x) => x.collectionId !== b.collectionId,
                            ),
                          )
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AddBundlesSheet
        open={adding}
        onOpenChange={setAdding}
        options={options}
        bundles={bundles}
        lockOf={lockOf}
        onChange={onChange}
      />
    </section>
  );
}

function AddBundlesSheet({
  open,
  onOpenChange,
  options,
  bundles,
  lockOf,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: readonly SaleEventBundleOption[];
  bundles: StudioBundle[];
  lockOf: (o: SaleEventBundleOption) => ReturnType<typeof bundleLock>;
  onChange: (bundles: StudioBundle[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const memberIds = new Set(bundles.map((b) => b.collectionId));
  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return options.filter((o) => !term || o.name.toLowerCase().includes(term));
  }, [options, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    const next = [...bundles];
    for (const id of selected) {
      if (!memberIds.has(id)) next.push({ collectionId: id, pcts: {} });
    }
    onChange(next);
    setSelected(new Set());
    onOpenChange(false);
  }

  const newCount = [...selected].filter((id) => !memberIds.has(id)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 [--input-edge:transparent] sm:max-w-lg"
      >
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle>Багц нэмэх</SheetTitle>
          <SheetDescription>
            Нэмсний дараа хэмжээ бүрт хувиа бичнэ. Өөр арга хэмжээнд орсон,
            дууссан эсвэл идэвхгүй багц сонгогдохгүй.
          </SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Багцын нэрээр хайх"
              className="pl-9"
            />
          </div>
        </div>
        <ul role="list" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {visible.length === 0 && (
            <li className="text-muted-foreground px-3 py-8 text-center text-sm">
              Илэрц олдсонгүй
            </li>
          )}
          {visible.map((o) => {
            const isMember = memberIds.has(o.id);
            const { locked, drafts } = lockOf(o);
            // Дууссан / идэвхгүй багцыг шинээр нэмэхгүй (SQL BUNDLE_UNAVAILABLE).
            const unavailable =
              o.status !== "available" ? BUNDLE_STATUS_LABEL[o.status] : null;
            const disabled =
              (Boolean(locked) || Boolean(unavailable)) && !isMember;
            const isOn = selected.has(o.id);
            return (
              <li key={o.id}>
                <label
                  aria-disabled={disabled || undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    disabled
                      ? "text-muted-foreground"
                      : "cursor-pointer " +
                          (isOn ? "bg-secondary" : "hover:bg-secondary/50"),
                  )}
                >
                  <Checkbox
                    checked={isOn || isMember}
                    disabled={disabled || isMember}
                    onCheckedChange={() => toggle(o.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {o.name}
                      {locked && (
                        <span className="font-normal"> — «{locked.name}»</span>
                      )}
                    </span>
                    {unavailable && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {unavailable}
                      </span>
                    )}
                    {drafts.length > 0 && !locked && (
                      <span className="text-muted-foreground block truncate text-xs">
                        ноорог: {drafts.join(", ")}
                      </span>
                    )}
                  </span>
                  {locked && !isMember && (
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                  )}
                  {isMember && (
                    <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
                      <Check className="size-3.5" />
                      Нэмсэн
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="bg-secondary/50 px-5 py-4">
          <Button
            type="button"
            className="bg-cta text-cta-foreground hover:bg-cta/90 w-full"
            disabled={newCount === 0}
            onClick={apply}
          >
            <Plus />
            {newCount === 0 ? "Багц сонгоно уу" : `${newCount} багц нэмэх`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
