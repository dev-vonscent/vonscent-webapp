"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Search for the admin customer list (backlog F2).
 *
 * Was a bare `<form action="/admin/customers">`, so nothing happened until
 * Enter — on a phone, where the keyboard's «go» key is the only Enter, that
 * read as a dead field. Now it is the same debounced live search as the
 * product list: state lives in the URL so the server component filters and
 * the view survives refresh and Back, and the request runs inside a
 * transition so the rows on screen stay put instead of the route's
 * `loading.tsx` blanking the table a character at a time.
 */
export function CustomersToolbar() {
  return (
    <UrlSearchField
      id="customer-search"
      label="Хэрэглэгчийг нэр эсвэл утасны дугаараар хайх"
      placeholder="Нэр, утсаар хайх…"
    />
  );
}

/**
 * The debounced `?q=` search field behind {@link CustomersToolbar}, for any
 * server-filtered admin list. Keeps the page's other params (tab, status) and
 * drops only `page`.
 */
export function UrlSearchField({
  id,
  label,
  placeholder,
}: {
  id: string;
  /** Screen-reader label. */
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = React.useState(urlQ);
  /** The last `?q=` this component has reconciled against. */
  const seenUrlQ = React.useRef(urlQ);
  const [pending, startTransition] = React.useTransition();

  // Adopt a `?q=` that changed from somewhere ELSE — the empty state's «Бүх
  // хэрэглэгч харах» link, or Back. Without this the field kept the old text
  // and the debounce below put the filter straight back on: the link looked
  // broken because the list re-filtered itself 300ms after it cleared.
  React.useEffect(() => {
    if (urlQ === seenUrlQ.current) return;
    seenUrlQ.current = urlQ;
    // Our own push lands here too; `q.trim()` already matches it, and
    // overwriting would eat a space the operator is still typing.
    setQ((current) => (urlQ === current.trim() ? current : urlQ));
  }, [urlQ]);

  const search = React.useCallback(
    (value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set("q", value);
      else next.delete("q");
      seenUrlQ.current = value;
      // Шинэ хайлт = шинэ жагсаалт. 3-р хуудсан дээр байхад хайхад хоосон
      // дэлгэц гарах нь «юу ч олдсонгүй» гэж уншигдана.
      next.delete("page");
      startTransition(() => {
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    },
    [params, router, pathname],
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (urlQ !== q.trim()) search(q.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [q, urlQ, search]);

  return (
    <div
      // Dim rather than block: the rows underneath are still the previous
      // result, and taking the field away mid-type is worse than a stale row.
      className={cn("transition-opacity", pending && "opacity-60")}
      aria-busy={pending}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        // `search` keeps the browser's clear button; the type is not `tel`
        // because the same field takes a name.
        inputMode="text"
        placeholder={placeholder}
        className="h-11 md:h-9 md:w-64"
      />
    </div>
  );
}
