"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxScroll,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { adminFetch } from "@/features/admin/lib/mutate";
import {
  customerLabel,
  type CustomerOption,
} from "@/features/admin/lib/customer-option";

/** «Хэнд ч биш» — жагсаалтын оройд үргэлж байх нийтийн сонголт. */
const PUBLIC: CustomerOption = {
  id: "__public__",
  full_name: "Бүх хэрэглэгч (нийтийн)",
  phone: null,
};

/**
 * Хувийн купоны эзэн сонгогч — хайлт нь СЕРВЕР дээр.
 *
 *   · нээхэд сервер өгсөн эхний хуудас (`initial`) харагдана;
 *   · бичих бүрд (250мс debounce) `/api/admin/customers/options` нэр эсвэл
 *     утсаар шүүнэ — хуучин хариу шинийг дарахгүй (AbortController);
 *   · сонгосон хүн хайлт солигдсон ч жагсаалтаас алга болохгүй (Base UI-ийн
 *     async загвар: сонгосныг `items`-д үлдээнэ).
 *
 * `null` = нийтийн купон.
 */
export function CustomerPicker({
  initial,
  value,
  onChange,
}: {
  initial: CustomerOption[];
  value: CustomerOption | null;
  onChange: (next: CustomerOption | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const term = q.trim();

  React.useEffect(() => {
    if (!term) {
      setResults(initial);
      setLoading(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await adminFetch<{ items: CustomerOption[] }>(
        `/api/admin/customers/options?q=${encodeURIComponent(term)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setFailed(!res.ok);
      if (res.ok) setResults(res.data.items);
      setLoading(false);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [term, initial]);

  const items = React.useMemo(() => {
    const list = term ? [...results] : [PUBLIC, ...results];
    if (value && !list.some((c) => c.id === value.id)) list.push(value);
    return list;
  }, [term, results, value]);

  const status = loading ? (
    <>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Хайж байна…
    </>
  ) : failed ? (
    "Хайлт амжилтгүй. Дахин оролдоно уу."
  ) : null;

  return (
    <Combobox
      items={items}
      value={value ?? PUBLIC}
      onValueChange={(next: CustomerOption | null) =>
        onChange(!next || next.id === PUBLIC.id ? null : next)
      }
      itemToStringLabel={customerLabel}
      isItemEqualToValue={(a: CustomerOption, b: CustomerOption) =>
        a.id === b.id
      }
      // Шүүлтийг сервер хийнэ — Base UI дахин шүүвэл утсаар олсон мөр
      // («9911…» нэрэнд байхгүй) алга болно.
      filter={null}
      inputValue={q}
      onInputValueChange={setQ}
      onOpenChange={(open) => {
        if (!open) setQ("");
      }}
    >
      <ComboboxTrigger>
        <ComboboxValue />
      </ComboboxTrigger>
      <ComboboxContent aria-busy={loading || undefined}>
        <ComboboxInput
          placeholder="Нэр эсвэл утасны дугаар"
          aria-label="Хэрэглэгч хайх"
        />
        <ComboboxScroll>
          <ComboboxStatus>{status}</ComboboxStatus>
          <ComboboxEmpty>
            {!loading && !failed && "Ийм хэрэглэгч олдсонгүй."}
          </ComboboxEmpty>
          <ComboboxList>
            {(c: CustomerOption) => (
              <ComboboxItem key={c.id} value={c}>
                <span className="truncate">
                  {c.id === PUBLIC.id ? c.full_name : customerLabel(c)}
                  {c.full_name && c.phone && (
                    <span className="text-muted-foreground"> · {c.phone}</span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxScroll>
      </ComboboxContent>
    </Combobox>
  );
}
