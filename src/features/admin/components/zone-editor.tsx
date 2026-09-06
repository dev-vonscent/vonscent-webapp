"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ShippingZoneConfig } from "@/lib/constants";
import {
  AIMAG_GROUP,
  ONE_ZONE_OPEN_AT_A_TIME,
  buildGroups,
  readAssignments,
  writeAssignments,
  zoneId,
  type Assignments,
  type Group,
  type Unit,
} from "@/features/admin/lib/zone-model";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function ZoneEditor({
  zones,
  onChange,
}: {
  zones: ShippingZoneConfig[];
  onChange: (next: ShippingZoneConfig[]) => void;
}) {
  // Both are pure derivations of what is stored — cheap enough (roughly 500
  // units) to rebuild rather than to keep in state, which is what keeps a zone
  // list and an assignment map from ever disagreeing.
  const groups = React.useMemo(() => buildGroups(zones), [zones]);
  const assignments = React.useMemo(
    () => readAssignments(zones, groups),
    [zones, groups],
  );

  const [open, setOpen] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  /** Which zone's add panel is open, and what it has staged so far. */
  const [picker, setPicker] = React.useState<{
    zone: string;
    group: string;
    staged: string[];
  } | null>(null);

  const totalUnits = groups.reduce((n, g) => n + g.units.length, 0);
  const assignedCount = groups.reduce(
    (n, g) => n + g.units.filter((u) => assignments[u.key]).length,
    0,
  );

  /**
   * Groups with something still unassigned.
   *
   * Adding is only ever needed when улсын хэмжээнд a хороо is created or
   * dissolved; taking a хороо off another zone is what the move bar is for, and
   * offering it here too was two ways to do one thing. So the panel shows the
   * unassigned pool and nothing else — and disappears when the pool is empty.
   */
  const freeGroups = React.useMemo(
    () =>
      groups
        .map((g) => ({ ...g, units: g.units.filter((u) => !assignments[u.key]) }))
        .filter((g) => g.units.length > 0),
    [groups, assignments],
  );

  const unitByKey = React.useMemo(() => {
    const m = new Map<string, Unit>();
    for (const g of groups) for (const u of g.units) m.set(u.key, u);
    return m;
  }, [groups]);

  // A unit list rebuilt from new data can drop keys (a split аймаг healing back
  // into one chip); a selection pointing at a key that no longer exists would
  // move nothing and look broken.
  React.useEffect(() => {
    setSelected((s) => {
      const kept = s.filter((k) => unitByKey.has(k));
      return kept.length === s.length ? s : kept;
    });
  }, [unitByKey]);

  function openOnly(id: string) {
    setOpen((o) =>
      ONE_ZONE_OPEN_AT_A_TIME ? [id] : o.includes(id) ? o : [...o, id],
    );
  }

  function handleOpenChange(next: string[]) {
    if (!ONE_ZONE_OPEN_AT_A_TIME) return setOpen(next);
    const added = next.find((v) => !open.includes(v));
    setOpen(added ? [added] : []);
    if (added !== picker?.zone) setPicker(null);
  }

  function apply(next: Assignments) {
    onChange(writeAssignments(zones, groups, next));
  }

  const toggle = (key: string) =>
    setSelected((s) =>
      s.includes(key) ? s.filter((k) => k !== key) : [...s, key],
    );

  /** "хороо" only when nothing but khoroos moved — аймаг chips are not хороо. */
  function noun(keys: string[]): string {
    return keys.every((k) => unitByKey.get(k)?.group !== AIMAG_GROUP)
      ? "хороо"
      : "нэгж";
  }

  function moveSelected(target: string) {
    const keys = selected;
    if (!keys.length) return;
    const next = { ...assignments };
    for (const key of keys) next[key] = target;
    apply(next);
    setSelected([]);
    openOnly(target);
    const zone = zones.find((z, i) => zoneId(z, i) === target);
    toast.success(
      `${keys.length} ${noun(keys)} «${zone?.name || target}» бүс рүү шилжлээ`,
    );
  }

  function commitPicker() {
    if (!picker?.staged.length) return;
    const next = { ...assignments };
    for (const key of picker.staged) next[key] = picker.zone;
    apply(next);
    toast.success(`${picker.staged.length} ${noun(picker.staged)} нэмэгдлээ`);
    setPicker(null);
  }

  const patch = (i: number, values: Partial<ShippingZoneConfig>) =>
    onChange(zones.map((z, j) => (j === i ? { ...z, ...values } : z)));

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        {assignedCount} нэгж оноогдсон · {totalUnits - assignedCount} нэгж
        оноогдоогүй (нэмэх самбараас олдоно)
      </p>

      <Accordion
        type="multiple"
        value={open}
        onValueChange={handleOpenChange}
        className="space-y-2"
      >
        {zones.map((z, i) => {
          const id = zoneId(z, i);
          const inZone = groups
            .map((g) => ({
              group: g,
              units: g.units.filter((u) => assignments[u.key] === id),
            }))
            .filter((g) => g.units.length > 0);
          const count = inZone.reduce((n, g) => n + g.units.length, 0);
          const head = inZone
            .slice(0, 3)
            .map((g) => `${g.group.title} ${g.units.length}`)
            .join(", ");

          return (
            <AccordionItem
              key={id}
              value={id}
              className="bg-muted/40 rounded-lg border-b-0 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* The code is the zone's identity — it is written onto every
                    order, so it is shown, never edited. */}
                <span
                  title={z.code}
                  className="bg-secondary field-edge flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                >
                  {z.code.slice(0, 3) || "—"}
                </span>
                <Input
                  value={z.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  placeholder="Бүсийн нэр"
                  aria-label={`${z.code} бүсийн нэр`}
                  className="min-w-32 flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={z.fee}
                    disabled={!z.deliverable}
                    onChange={(e) =>
                      patch(i, { fee: Number(e.target.value) || 0 })
                    }
                    aria-label={`${z.code} бүсийн хүргэлтийн төлбөр`}
                    className="pr-7 text-right tabular-nums"
                  />
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
                    ₮
                  </span>
                </div>
              </div>

              <AccordionTrigger className="text-muted-foreground w-full gap-2 py-2 text-xs">
                <span className="truncate text-left">
                  {count
                    ? `${count} нэгж · ${head}${inZone.length > 3 ? ` +${inZone.length - 3}` : ""}`
                    : "Хамрах газар нутаг оноогдоогүй"}
                </span>
              </AccordionTrigger>

              <AccordionContent className="space-y-3 pb-3">
                {inZone.map(({ group, units }) => (
                  <div key={group.id} className="space-y-1.5">
                    <span className="text-foreground text-xs font-medium">
                      {group.title} · {units.length} {group.noun}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {units.map((u) => (
                        <Chip
                          key={u.key}
                          label={u.label}
                          title={`${group.title} — ${u.label}`}
                          selected={selected.includes(u.key)}
                          onClick={() => toggle(u.key)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {z.remote ? (
                  // Улаанбаатараас гадуурх хаяг энэ бүсээр өөрөө тооцогддог
                  // (checkout/api.ts ruralFallback), тул хоосон байх нь хэвийн.
                  // Хот дотор нь ямар нэг хороо оноогдсон бол (Багануур г.м.)
                  // тэр нь чипээр харагдана, энэ мөр нь ойлголт төөрөгдүүлнэ.
                  count === 0 && (
                    <p className="text-muted-foreground text-xs">
                      Улаанбаатараас гадуурх бүх хаяг энэ бүсээр тооцогдоно —
                      хороо оноох шаардлагагүй.
                    </p>
                  )
                ) : picker?.zone === id ? (
                  <AddPanel
                    groups={freeGroups}
                    zoneName={z.name || z.code}
                    state={picker}
                    onState={setPicker}
                    onCommit={commitPicker}
                  />
                ) : (
                  freeGroups.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPicker({
                          zone: id,
                          group: freeGroups[0].id,
                          staged: [],
                        })
                      }
                    >
                      <Plus className="size-4" /> Оноогдоогүй хороо нэмэх
                    </Button>
                  )
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {selected.length > 0 && (
        <MoveBar
          count={selected.length}
          noun={noun(selected)}
          zones={zones}
          from={[
            ...new Set(
              selected
                .map((k) => assignments[k])
                .filter(Boolean)
                .map((zid) => zones.find((z, i) => zoneId(z, i) === zid)?.code)
                .filter((c): c is string => Boolean(c)),
            ),
          ]}
          isFull={(zid) => selected.every((k) => assignments[k] === zid)}
          onMove={moveSelected}
          onClear={() => setSelected([])}
        />
      )}
    </div>
  );
}

/**
 * A khoroo chip. Never the full "Улаанбаатар, Баянзүрх — 5-р хороо" — inside
 * its district group the number alone says everything, and that is the whole
 * point of grouping.
 */
function Chip({
  label,
  title,
  selected,
  onClick,
}: {
  label: string;
  title: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={Boolean(selected)}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2.5 text-sm font-medium transition-colors",
        selected
          ? "bg-muted-foreground text-background"
          : "bg-secondary text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}

/**
 * The picker for the unassigned pool.
 *
 * `groups` arrives pre-filtered to units no zone holds, so there is nothing to
 * dim and no other zone to steal from: pick a district, tap the хороо that are
 * still loose, commit them in one press.
 */
function AddPanel({
  groups,
  zoneName,
  state,
  onState,
  onCommit,
}: {
  groups: Group[];
  zoneName: string;
  state: { zone: string; group: string; staged: string[] };
  onState: (
    next: { zone: string; group: string; staged: string[] } | null,
  ) => void;
  onCommit: () => void;
}) {
  const group = groups.find((g) => g.id === state.group) ?? groups[0];

  return (
    <div className="bg-accent/40 field-edge space-y-3 rounded-md p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          «{zoneName}» бүсэд оноогдоогүй хороо нэмэх
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => onState(null)}
          aria-label="Хороо нэмэхийг болих"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">1. Дүүрэг / аймаг сонго</Label>
        <Select
          value={group.id}
          onValueChange={(v) => onState({ ...state, group: v, staged: [] })}
        >
          <SelectTrigger className="h-11 w-full text-xs sm:h-9 sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.pickerLabel} ({g.units.length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">
          2. Нэмэх {group.nounOwn} товшиж сонго
        </Label>

        <div className="flex flex-wrap gap-1.5">
          {group.units.map((u) => (
            <Chip
              key={u.key}
              label={u.label}
              title={`${group.title} — ${u.label}`}
              selected={state.staged.includes(u.key)}
              onClick={() =>
                onState({
                  ...state,
                  staged: state.staged.includes(u.key)
                    ? state.staged.filter((k) => k !== u.key)
                    : [...state.staged, u.key],
                })
              }
            />
          ))}
        </div>

        <p className="text-muted-foreground text-xs">
          Энд зөвхөн ямар ч бүсэд ороогүй {group.noun} харагдана. Өөр бүсэд
          байгаа хороог шилжүүлэхдээ түүнийг нь товшоод доод талын самбараас
          зорих бүсээ сонгоно.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={state.staged.length === 0}
        onClick={onCommit}
      >
        {state.staged.length
          ? `${state.staged.length} ${group.noun} нэмэх`
          : "Нэмэх"}
      </Button>
    </div>
  );
}

/**
 * The move bar.
 *
 * It exists so that re-zoning is one tap on a target rather than a delete here
 * and a three-select re-add there. The targets are the zone letters alone: five
 * full names side by side wrapped onto three lines and buried the one thing the
 * bar is for. The name still reaches a screen reader, and a hover title, and
 * the line above the letters spells out where the selection sits today.
 */
function MoveBar({
  count,
  noun,
  zones,
  from,
  isFull,
  onMove,
  onClear,
}: {
  count: number;
  noun: string;
  zones: ShippingZoneConfig[];
  /** Zone codes the selection is spread across, for the "-аас" half of the line. */
  from: string[];
  isFull: (zoneId: string) => boolean;
  onMove: (target: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3">
      <div className="bg-card/95 field-edge animate-fade-up pointer-events-auto mb-3 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-lg px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs">
          <span className="font-semibold tabular-nums">{count}</span> {noun}
          {from.length > 0 && (
            <span className="text-muted-foreground">
              {" "}
              ({from.join(", ")} бүсээс)
            </span>
          )}{" "}
          сонгогдлоо. Аль бүс рүү шилжүүлэх вэ?
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {zones.map((z, i) => {
            const id = zoneId(z, i);
            const full = isFull(id);
            return (
              <button
                key={id}
                type="button"
                disabled={full}
                onClick={() => onMove(id)}
                title={
                  full
                    ? `Сонгосон нь аль хэдийн «${z.name}» бүсэд байна`
                    : `${z.name} руу шилжүүлэх`
                }
                aria-label={`${z.name} руу шилжүүлэх`}
                className={cn(
                  "size-10 shrink-0 rounded-md text-sm font-semibold transition-colors",
                  full
                    ? "bg-secondary text-muted-foreground cursor-default opacity-45"
                    : "bg-secondary text-foreground hover:bg-muted-foreground hover:text-background",
                )}
              >
                {z.code}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={onClear}
          aria-label="Сонголтыг цуцлах"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
