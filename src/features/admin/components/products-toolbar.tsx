"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Search / filter / sort for the admin product list (A2). State lives in the
 * URL so the server component filters and the view survives refresh and back.
 *
 * Visibility and stock are two independent questions and used to share one
 * «Төлөв» dropdown, which made them mutually exclusive: "published but sold
 * out" — the single most urgent row in the catalogue — could not be asked for
 * at all. Worse, that dropdown's «Үлдэгдэл бага» sat next to the sort
 * dropdown's «Үлдэгдэл багаас», two controls that read as the same thing and
 * did not do the same thing.
 *
 * Now each control answers one question: chips for visibility (three states,
 * visible without opening anything), a dropdown for stock, a dropdown for
 * order. They combine.
 */
const VISIBILITY = [
  { value: "", label: "Бүгд" },
  { value: "active", label: "Идэвхтэй" },
  { value: "hidden", label: "Нуусан" },
];

export function ProductsToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  // Every filter change re-runs the server component. Inside a transition the
  // current rows stay on screen and the route's `loading.tsx` never takes over,
  // so typing doesn't blank the list a character at a time.
  const [pending, startTransition] = React.useTransition();

  const patch = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // The old single-parameter form; carrying it forward would re-apply a
      // filter the operator just cleared.
      next.delete("status");
      startTransition(() => {
        router.replace(`/admin/products?${next.toString()}`);
      });
    },
    [params, router],
  );

  // Debounced live search, same feel as the storefront.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) patch("q", q.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, patch]);

  const vis = params.get("vis") ?? "";

  return (
    <div
      // Dim rather than block: the list under it is still the previous result,
      // and taking the controls away mid-type is worse than a stale row.
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 transition-opacity",
        pending && "opacity-60",
      )}
      aria-busy={pending}
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        aria-label="Нэр, брэндээр хайх"
        placeholder="Нэр, брэндээр хайх…"
        className="h-11 w-56 md:h-9"
      />

      <div
        role="group"
        aria-label="Харагдацаар шүүх"
        className="flex flex-wrap items-center gap-1.5"
      >
        {VISIBILITY.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={vis === v.value}
            onClick={() => patch("vis", v.value)}
            className={cn(
              // Every chip carries a surface: the borderless system leaves an
              // unfilled chip as a bare floating word.
              "min-h-11 rounded-full px-3.5 text-xs font-medium transition-colors md:min-h-9",
              vis === v.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Select
        value={params.get("stock") ?? "all"}
        onValueChange={(v) => patch("stock", v === "all" ? "" : v)}
      >
        <SelectTrigger aria-label="Үлдэгдлээр шүүх" className="h-11 w-40 md:h-9">
          <SelectValue placeholder="Үлдэгдэл" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Бүх үлдэгдэл</SelectItem>
          <SelectItem value="ok">Хэвийн</SelectItem>
          <SelectItem value="low">Бага</SelectItem>
          <SelectItem value="soldout">Дууссан</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={params.get("sort") ?? "name"}
        onValueChange={(v) => patch("sort", v === "name" ? "" : v)}
      >
        <SelectTrigger aria-label="Эрэмбэлэх" className="h-11 w-44 md:h-9">
          <SelectValue placeholder="Эрэмбэ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Нэрээр</SelectItem>
          <SelectItem value="brand">Брэндээр</SelectItem>
          <SelectItem value="price-asc">Үнэ өсөхөөр</SelectItem>
          <SelectItem value="price-desc">Үнэ буурахаар</SelectItem>
          <SelectItem value="stock">Үлдэгдэл багаас</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
