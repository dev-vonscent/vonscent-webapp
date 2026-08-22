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

/**
 * Search / filter / sort controls for the admin product list (A2). State
 * lives in the URL so the server component filters and the view survives
 * refresh / back.
 */
export function ProductsToolbar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const patch = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`/admin/products?${next.toString()}`);
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Нэр, брэндээр хайх…"
        className="h-9 w-56"
      />
      <Select
        value={params.get("status") ?? "all"}
        onValueChange={(v) => patch("status", v === "all" ? "" : v)}
      >
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Төлөв" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Бүх төлөв</SelectItem>
          <SelectItem value="active">Идэвхтэй</SelectItem>
          <SelectItem value="hidden">Нуусан</SelectItem>
          <SelectItem value="low">Үлдэгдэл бага</SelectItem>
          <SelectItem value="soldout">Дууссан</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={params.get("sort") ?? "name"}
        onValueChange={(v) => patch("sort", v === "name" ? "" : v)}
      >
        <SelectTrigger className="h-9 w-44">
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
