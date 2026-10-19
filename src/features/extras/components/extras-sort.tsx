"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXTRA_SORTS, EXTRA_SORT_LABEL, parseExtraSort } from "../lib/sort";

/** Нэмэлт барааны таб — шүүлтүүргүй, зөвхөн эрэмбэ (plan §9). */
export function ExtrasSort() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = parseExtraSort(params.get("sort"));
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const next = new URLSearchParams(params.toString());
        if (v === "recommended") next.delete("sort");
        else next.set("sort", v);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <SelectTrigger aria-label="Эрэмбэлэх" className="w-45">
        <SelectValue placeholder="Эрэмбэлэх" />
      </SelectTrigger>
      <SelectContent>
        {EXTRA_SORTS.map((s) => (
          <SelectItem key={s} value={s}>
            {EXTRA_SORT_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
