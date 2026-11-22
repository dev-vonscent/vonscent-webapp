"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HERO_LIMITS } from "@/lib/constants";
import { Tooltip } from "@/components/shared/tooltip";
import { cn } from "@/lib/utils";
import { heroTargetHref, isInternalPath } from "../lib";
import {
  CUSTOM_LINK_KEY,
  linkOptionKey,
  type HeroLinkOption,
} from "../link-presets";
import type { HeroTarget } from "../types";

/**
 * «Дарахад хаашаа очих вэ?» (studio-ux.md D5) — хүний хэлээр сонгоно;
 * `HeroTarget`-ийн төрөл, query админд харагдахгүй. Жагсаалтад таарахгүй
 * зорилт (хуучин өгөгдөл) «Өөр хуудас…» болж хаяг нь харагдана.
 */
export function HeroLinkPicker({
  label,
  value,
  options,
  disabled,
  highlighted = false,
  onChange,
  onRemove,
}: {
  /** «Гол товч «Хямдралыг үзэх»». */
  label: React.ReactNode;
  value: HeroTarget;
  options: readonly HeroLinkOption[];
  disabled?: boolean;
  /** Canvas дээр энэ товчийг засаж байна. */
  highlighted?: boolean;
  onChange: (t: HeroTarget) => void;
  onRemove?: () => void;
}) {
  const key = linkOptionKey(value, options);
  const [custom, setCustom] = React.useState(key === CUSTOM_LINK_KEY);
  const [href, setHref] = React.useState(() => heroTargetHref(value));
  const showCustom = custom || key === CUSTOM_LINK_KEY;
  const hrefError =
    showCustom && !isInternalPath(href)
      ? "Сайтын дотоод хаяг — «/»-ээр эхэлнэ, жишээ: /blog"
      : null;
  // Жагсаалтын дараалал хэвээр: улирлын бүлгээс өмнөх / дараах сонголтууд.
  const firstSeason = options.findIndex((o) => o.group === "season");
  const cut = firstSeason < 0 ? options.length : firstSeason;
  const head = options.slice(0, cut).filter((o) => !o.group);
  const tail = options.slice(cut).filter((o) => !o.group);
  const seasons = options.filter((o) => o.group === "season");

  return (
    <div
      className={cn(
        "space-y-2 rounded-md px-3 py-2",
        highlighted && "bg-secondary ring-cta ring-2",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-40 text-sm">{label}</div>
        <Select
          value={showCustom ? CUSTOM_LINK_KEY : key}
          disabled={disabled}
          onValueChange={(k) => {
            if (k === CUSTOM_LINK_KEY) {
              setCustom(true);
              setHref(heroTargetHref(value));
              return;
            }
            const o = options.find((x) => x.key === k);
            if (!o) return;
            setCustom(false);
            onChange(o.target);
          }}
        >
          <SelectTrigger
            aria-label="Дарахад хаашаа очих вэ?"
            className="w-full sm:w-72"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {head.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
            {seasons.length > 0 && (
              <SelectGroup>
                <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs">
                  Улирлын үнэртэн
                </p>
                {seasons.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {tail.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_LINK_KEY}>Өөр хуудас…</SelectItem>
          </SelectContent>
        </Select>
        {onRemove ? (
          <Tooltip content="Товчийг хасах" align="end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-9 rounded-full"
              aria-label="Товчийг хасах"
              disabled={disabled}
              onClick={onRemove}
            >
              <X />
            </Button>
          </Tooltip>
        ) : (
          // Мөрүүдийн сонгогч нэг шулуунд — хасах товчны зай.
          <span aria-hidden className="hidden size-9 shrink-0 sm:block" />
        )}
      </div>
      {showCustom && (
        <div className="space-y-1">
          <Input
            value={href}
            disabled={disabled}
            maxLength={HERO_LIMITS.path}
            placeholder="/catalog?tags=new"
            aria-label="Хуудасны хаяг"
            aria-invalid={hrefError ? true : undefined}
            onChange={(e) => {
              const next = e.target.value.trim();
              setHref(next);
              if (isInternalPath(next)) onChange({ type: "path", href: next });
            }}
          />
          <p
            className={cn(
              "text-xs",
              hrefError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {hrefError ?? "«vonscent.mn»-ий дараах хэсэг, жишээ: /blog"}
          </p>
        </div>
      )}
    </div>
  );
}
