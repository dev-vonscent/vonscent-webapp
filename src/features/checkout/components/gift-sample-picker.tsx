"use client";

import * as React from "react";
import Image from "next/image";
import { Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { GIFT_THRESHOLD } from "@/lib/constants";

interface GiftOption {
  id: string;
  name: string;
  brand: string;
  image: string | null;
}

/**
 * Сар бүрийн бэлгийн 1мл sample сонгох хэсэг (questions.md №2–3). Shown when
 * the goods value (after coupon) clears 200,000₮ — one pick per full 200k.
 * The server re-validates every pick, so this is presentation only.
 */
export function GiftSamplePicker({
  allowance,
  value,
  onChange,
}: {
  /** How many samples this order may pick (0 hides the section). */
  allowance: number;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [options, setOptions] = React.useState<GiftOption[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/gifts")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setOptions(d?.enabled ? (d.products ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Drop picks that no longer fit a shrunken allowance (coupon added, items
  // removed) so the submit payload never over-asks.
  React.useEffect(() => {
    if (value.length > allowance) onChange(value.slice(0, allowance));
  }, [allowance, value, onChange]);

  if (allowance <= 0 || !options || options.length === 0) return null;

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else if (value.length < allowance) {
      onChange([...value, id]);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Gift className="text-gold-strong size-5" />
          Бэлгийн 1мл sample
        </h2>
        <p className="text-muted-foreground text-sm">
          {formatPrice(GIFT_THRESHOLD)} тутамд 1 sample, багц бүр дор хаяж 1
          — та <strong>{allowance}</strong> ширхэг сонгох эрхтэй (
          {value.length} сонгосон).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {options.map((o) => {
            const selected = value.includes(o.id);
            const full = !selected && value.length >= allowance;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                disabled={full}
                aria-pressed={selected}
                className={cn(
                  "border-border rounded-lg border p-2 text-left text-xs transition-colors",
                  selected
                    ? "border-gold-strong ring-gold-strong/60 ring-2"
                    : full
                      ? "opacity-40"
                      : "hover:border-primary/50",
                )}
              >
                <div className="bg-muted relative mb-2 aspect-square w-full overflow-hidden rounded-md">
                  {o.image && (
                    <Image
                      src={o.image}
                      alt={o.name}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  )}
                </div>
                <p className="text-muted-foreground uppercase">{o.brand}</p>
                <p className="font-medium">{o.name}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
