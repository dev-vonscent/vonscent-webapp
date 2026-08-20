"use client";

import * as React from "react";
import Image from "next/image";
import { Gift, Search, Check, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GiftCandidate } from "../types";

export function GiftPicker({
  candidates,
  giftMl,
  value,
  onChange,
}: {
  candidates: GiftCandidate[];
  giftMl: number;
  value: string | null;
  onChange: (productId: string | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const selected = candidates.find((c) => c.productId === value) ?? null;
  const filtered = q
    ? candidates.filter((c) =>
        `${c.brand} ${c.name}`.toLowerCase().includes(q.toLowerCase()),
      )
    : candidates;

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="border-border bg-secondary hover:bg-accent flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
        >
          <Gift className="text-gold-strong size-4 shrink-0" />
          <span
            className={cn(
              "flex-1 truncate",
              !selected && "text-muted-foreground",
            )}
          >
            {selected
              ? `${selected.brand} — ${selected.name}`
              : `Бэлгээ сонгоно уу (${giftMl}ml)`}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-3">
        <DialogTitle className="font-serif">Нэмэлт бэлэг сонгох</DialogTitle>
        <p className="text-muted-foreground -mt-1 text-xs">
          Багцад ороогүй үнэртнээс нэгийг {giftMl}ml бэлгээр үнэ төлбөргүй авна.
        </p>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Үнэртэн хайх…"
            className="pl-9"
          />
        </div>
        <div className="-mx-2 max-h-80 space-y-1 overflow-y-auto px-2">
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Илэрц олдсонгүй.
            </p>
          )}
          {filtered.map((c) => {
            const active = c.productId === value;
            return (
              <button
                key={c.productId}
                type="button"
                onClick={() => pick(c.productId)}
                className={cn(
                  "hover:bg-accent flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                  active && "bg-accent",
                )}
              >
                <div className="bg-muted border-border relative size-12 shrink-0 overflow-hidden rounded-md border">
                  {c.image && (
                    <Image
                      src={c.image.url}
                      alt={c.image.alt || c.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    {c.brand}
                  </p>
                  <p className="truncate text-sm font-medium">{c.name}</p>
                </div>
                {active && (
                  <Check className="text-gold-strong size-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
