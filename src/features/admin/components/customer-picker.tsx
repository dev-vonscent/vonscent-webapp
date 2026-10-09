"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxScroll,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { DrawerPortalContext } from "@/features/admin/components/form-drawer";
import { adminFetch } from "@/features/admin/lib/mutate";
import {
  customerLabel,
  type CustomerOption,
} from "@/features/admin/lib/customer-option";

/**
 * Хувийн купоны эзэн сонгогч — хайлт нь СЕРВЕР дээр.
 *
 *   · нээхэд сервер өгсөн эхний хуудас (`initial`) харагдана;
 *   · бичих бүрд (250мс debounce) `/api/admin/customers/options` нэр эсвэл
 *     утсаар шүүнэ — хуучин хариу шинийг дарахгүй (AbortController);
 *   · сонгосон хүн хайлт солигдсон ч жагсаалтаас алга болохгүй (Base UI-ийн
 *     async загвар: сонгосныг `items`-д үлдээнэ).
 *
 * `null` = хэн ч сонгогдоогүй. Нийтийн купон тусдаа табтай болсон тул
 * «Бүх хэрэглэгч» гэсэн сонголт энд байхгүй — хувийн купон заавал эзэнтэй.
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
    const list = [...results];
    if (value && !list.some((c) => c.id === value.id)) list.push(value);
    return list;
  }, [results, value]);

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
      value={value}
      onValueChange={(next: CustomerOption | null) => onChange(next ?? null)}
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
        <ComboboxValue placeholder="Хэрэглэгч сонгоно уу" />
      </ComboboxTrigger>
      <PickerPopup aria-busy={loading || undefined}>
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
                  {customerLabel(c)}
                  {c.full_name && c.phone && (
                    <span className="text-muted-foreground"> · {c.phone}</span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxScroll>
      </PickerPopup>
    </Combobox>
  );
}

/**
 * `ComboboxContent`-тэй ижил, гэхдээ drawer дотор байвал popup-ыг drawer-ийн
 * панел руу portal хийнэ (`DrawerPortalContext`). `<body>`-д гарвал Radix
 * modal-ын фокусын түгжээ хайлтын талбарыг ашиглах боломжгүй болгодог.
 */
function PickerPopup({
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {
  const container = React.useContext(DrawerPortalContext);
  return (
    <ComboboxPrimitive.Portal container={container ?? undefined}>
      <ComboboxPrimitive.Positioner
        align="start"
        sideOffset={4}
        className="z-50 outline-none"
      >
        <ComboboxPrimitive.Popup
          className="border-border bg-popover text-popover-foreground flex max-h-[min(24rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) min-w-56 origin-(--transform-origin) flex-col overflow-hidden rounded-md border shadow-md transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}
