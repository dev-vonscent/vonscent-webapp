"use client";

import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFilterQuery } from "./use-filter-query";

const OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "Шинэ эхэндээ" },
  { value: "popular", label: "Эрэлттэй" },
  { value: "price_asc", label: "Үнэ: бага → их" },
  { value: "price_desc", label: "Үнэ: их → бага" },
  { value: "name", label: "Нэрээр (А-Я)" },
];

export function CatalogSort({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  const { setSingle, searchParams } = useFilterQuery();
  const current = searchParams.get("sort") ?? "new";

  return (
    <Select
      value={current}
      onValueChange={(v) => setSingle("sort", v === "new" ? undefined : v)}
    >
      <SelectTrigger
        aria-label="Эрэмбэлэх"
        className={cn(
          iconOnly
            ? "size-10 shrink-0 justify-center p-0 [&>svg:last-child]:hidden"
            : "w-45",
          className,
        )}
      >
        {iconOnly ? (
          <ArrowUpDown className="size-4" />
        ) : (
          <SelectValue placeholder="Эрэмбэлэх" />
        )}
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
