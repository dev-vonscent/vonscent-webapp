"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AIMAGS,
  getChildren,
  getKhoroos,
  childLabel,
  formatKhoroo,
  resolveAdm2,
} from "@/lib/geo/locations";
import { areaKey } from "@/lib/geo/zone";

/**
 * Which сум / хороо a delivery zone covers (todo.md B5b).
 *
 * The client's А/Б table arrives as a list of khoroos, so the editor is built
 * around adding one row at a time: pick аймаг → сум/дүүрэг, then either the
 * whole district or specific khoroos. Adding a khoroo of a district that is
 * already listed wholesale is allowed and meaningful — `resolveZone` lets the
 * narrower rule win, which is how three khoroos get lifted out of Б into А.
 */
export function ZoneAreas({
  areas,
  onChange,
}: {
  areas: string[];
  onChange: (next: string[]) => void;
}) {
  const [aimag, setAimag] = React.useState("");
  const [adm2, setAdm2] = React.useState("");
  const [khoroo, setKhoroo] = React.useState("");

  const khoroos = getKhoroos(adm2);

  function add() {
    if (!adm2) return;
    const key = areaKey(adm2, khoroo ? Number(khoroo) : null);
    if (!areas.includes(key)) onChange([...areas, key]);
    setKhoroo("");
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Хамрах газар нутаг</Label>

      {areas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {areas.map((key) => (
            <li key={key}>
              <span className="bg-secondary flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
                {describeArea(key)}
                <button
                  type="button"
                  onClick={() => onChange(areas.filter((a) => a !== key))}
                  aria-label={`${describeArea(key)} хасах`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={aimag}
          onValueChange={(v) => {
            setAimag(v);
            setAdm2("");
            setKhoroo("");
          }}
        >
          <SelectTrigger className="h-11 w-44 text-xs md:h-9">
            <SelectValue placeholder="Хот / аймаг" />
          </SelectTrigger>
          <SelectContent>
            {AIMAGS.map((a) => (
              <SelectItem key={a.code} value={a.code}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={adm2}
          onValueChange={(v) => {
            setAdm2(v);
            setKhoroo("");
          }}
          disabled={!aimag}
        >
          <SelectTrigger className="h-11 w-44 text-xs md:h-9">
            <SelectValue placeholder={childLabel(aimag)} />
          </SelectTrigger>
          <SelectContent>
            {getChildren(aimag).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {khoroos.length > 0 && (
          <Select value={khoroo} onValueChange={setKhoroo}>
            <SelectTrigger className="h-11 w-40 text-xs md:h-9">
              <SelectValue placeholder="Бүх хороо" />
            </SelectTrigger>
            <SelectContent>
              {khoroos.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {formatKhoroo(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!adm2}
          onClick={add}
        >
          <Plus className="size-4" /> Нэмэх
        </Button>
      </div>
    </div>
  );
}

/** "Улаанбаатар, Баянгол — 12-р хороо" for a stored area key. */
function describeArea(key: string): string {
  const [code, khoroo] = key.split(":");
  const hit = resolveAdm2(code);
  if (!hit) return key;
  const base = `${hit.aimag.name}, ${hit.child.name}`;
  return khoroo ? `${base} — ${formatKhoroo(Number(khoroo))}` : base;
}
