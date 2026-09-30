"use client";

import * as React from "react";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useCart,
  type CartCollection,
  type CartCollectionSize,
  type CartItem,
} from "@/features/cart/store";
import { cartMlFor } from "@/features/cart/budget";
import { maxUnits } from "@/features/products/sellable";
import type { BundleSizeQuote } from "@/features/checkout/api";
import type { ProductDetail } from "@/lib/types";

/** Засах dialog-ийн нэг хэмжээний сонголт — дан ус ба багц хоёуланд. */
interface SizeOption {
  ml: number;
  price: number;
  available: boolean;
  /** Байхгүй үеийн тайлбар («Байхгүй» / «Түр байхгүй»). */
  note: string;
}

type Target =
  | { kind: "item"; line: CartItem }
  | { kind: "collection"; line: CartCollection };

/**
 * Төлбөрийн хуудасны тоймын мөрийг засах dialog (desktop) / доод sheet (утас).
 *
 * Тойм нь уншихад зориулагдсан — мөр бүрт select, stepper байхад үнэ урт
 * болмогц хяналтууд доош унаж, багцын гишүүдийн жагсаалт тоймыг сунгадаг
 * байв. Засвар энд төвлөрнө: хэмжээ (дан ус ба БАГЦ), тоо ширхэг, устгах.
 *
 * Ноорог: өөрчлөлт «Хадгалах» дарахад л сагс руу НЭГ бичилтээр очно
 * (`editItem` / `editCollection` / `editBuyNow`) — хаавал юу ч өөрчлөгдөхгүй.
 * Хэмжээ, үнэ, үлдэгдлийг нээх бүрд серверээс шинээр авна: сагс
 * localStorage-д долоо хоногоор сууж болох тул хадгалсан үнэд найдахгүй.
 * Багцын үнийг клиент дээр дахин бодохгүй — `quoteBundleSizes` захиалгатай
 * ижил замаар үнэлнэ.
 */
export function OrderLineEditor({
  target,
  buyNow,
  open,
  onOpenChange,
}: {
  target: Target;
  /** «Захиалах» мөр: сагсны бусад мөртэй үлдэгдэл хуваалцахгүй, устгах товчгүй. */
  buyNow: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const line = target.line;
  const title = line.name;
  const description =
    target.kind === "item"
      ? target.line.brand
      : `Багц · ${target.line.members.length} үнэртэн`;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="sm:max-w-md"
    >
      {/* Нээх бүрд ноорог шинээр эхэлнэ: хаагдсан үед mount хийгдэхгүй. */}
      {open && (
        <EditorBody
          target={target}
          buyNow={buyNow}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  );
}

/** Серверээс ирэх мэдээлэл: хэмжээний сонголт + гишүүн/барааны үлдэгдэл. */
interface Loaded {
  options: SizeOption[];
  /** productId → эх савны үлдэгдэл ml. */
  stock: Map<string, number>;
  /** Дан ус: ml → variant. */
  variants?: Map<
    number,
    { variantId: string; price: number; sellable: boolean }
  >;
  /** Багц: ml → серверийн үнэлгээ. */
  quotes?: Map<number, BundleSizeQuote>;
}

function EditorBody({
  target,
  buyNow,
  onDone,
}: {
  target: Target;
  buyNow: boolean;
  onDone: () => void;
}) {
  const items = useCart((s) => s.items);
  const collections = useCart((s) => s.collections);
  const editItem = useCart((s) => s.editItem);
  const editCollection = useCart((s) => s.editCollection);
  const editBuyNow = useCart((s) => s.editBuyNow);
  const remove = useCart((s) => s.remove);
  const removeCollection = useCart((s) => s.removeCollection);

  const uid = React.useId();
  const line = target.line;
  const [ml, setMl] = React.useState(line.ml);
  const [qty, setQty] = React.useState(line.qty);
  /** «+»-ийг хязгаарт дарсан эсвэл хэмжээ солиход тоо буурсан тайлбар. */
  const [hint, setHint] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Loaded | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  const productIds = React.useMemo(
    () =>
      target.kind === "item"
        ? [target.line.productId]
        : target.line.members.map((m) => m.productId),
    [target],
  );

  React.useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const load =
      target.kind === "item"
        ? loadItem(target.line.productId)
        : loadCollection(target.line, productIds);
    load
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [target, productIds, attempt]);

  /**
   * Сонгосон хэмжээгээр авч болох дээд тоо. Сагсны БУСАД мөрийн хэрэглээг
   * хасна (`use-cart-availability`-тэй ижил дүрэм); «Захиалах» мөр сагсанд
   * байдаггүй тул ганцаараа. Шинэ хэмжээ сагсанд аль хэдийн байвал тэр мөр
   * «бусад»-д орно — хадгалахад хоёр нийлэхэд нийлбэр нь үлдэгдэлд багтана.
   * Мэдээлэл ирээгүй / унасан бол `Infinity`: сервер хамгаална.
   */
  const max = React.useMemo(() => {
    if (!data) return Infinity;
    const others = buyNow
      ? { items: [], collections: [] }
      : target.kind === "item"
        ? { items: items.filter((i) => i.key !== line.key), collections }
        : { items, collections: collections.filter((c) => c.key !== line.key) };
    const option = data.options.find((o) => o.ml === ml);
    const sellable = option?.available ?? false;
    let cap = Infinity;
    for (const id of productIds) {
      const available = data.stock.get(id);
      if (available == null) continue;
      cap = Math.min(
        cap,
        maxUnits({
          ml,
          sellable,
          remainingMl: available - cartMlFor(id, others),
        }),
      );
    }
    return cap;
  }, [data, buyNow, target.kind, items, collections, line.key, ml, productIds]);

  const option = data?.options.find((o) => o.ml === ml) ?? null;
  const unitPrice = option?.price ?? line.unitPrice;
  const lineTotal = unitPrice * qty;
  /**
   * Багцын хямдралын өмнөх дүн — tile дээрх (хямдарсан) үнэтэй нийт дүн
   * зөрөхгүйн тулд гол тоо нь хямдарсан, энэ нь зураастай хажууд нь.
   */
  const listTotal =
    target.kind === "collection"
      ? (data?.quotes?.get(ml)?.memberSum ??
          target.line.members.reduce((s, m) => s + m.price, 0)) * qty
      : lineTotal;
  const outOfStock = max < 1;
  const changed = ml !== line.ml || qty !== line.qty;

  function pickSize(next: number) {
    const o = data?.options.find((x) => x.ml === next);
    if (!o?.available) return;
    setMl(next);
    setHint(null);
  }

  // Хэмжээ солиход тоо шинэ хязгаараас хэтэрвэл буулгаж, яагаад гэдгийг хэлнэ.
  React.useEffect(() => {
    if (Number.isFinite(max) && max >= 1 && qty > max) {
      setQty(max);
      setHint(`${ml}ml-ээр ${max} ш л авах боломжтой тул тоог багасгалаа.`);
    }
  }, [max, qty, ml]);

  function increment() {
    if (qty < max) {
      setQty(qty + 1);
      setHint(null);
      return;
    }
    setHint(
      max >= 1
        ? `Үлдэгдэл хомс — ${ml}ml-ээр ${max} ш л авах боломжтой.`
        : "Энэ хэмжээний үлдэгдэл хүрэлцэхгүй байна.",
    );
  }

  function save() {
    if (!changed) return onDone();
    if (target.kind === "item") {
      const v = data?.variants?.get(ml);
      // Хэмжээ солиогүй бол variant-ыг хэвээр нь; солисон бол серверийн шинэ.
      const variant =
        ml === line.ml
          ? {
              variantId: target.line.variantId,
              ml: line.ml,
              unitPrice: target.line.unitPrice,
            }
          : v && { variantId: v.variantId, ml, unitPrice: v.price };
      if (!variant) return;
      const edit = { variant, qty };
      if (buyNow) editBuyNow(edit);
      else editItem(line.key, edit);
    } else {
      const size =
        ml === line.ml
          ? currentSize(target.line)
          : sizeFromQuote(target.line, data?.quotes?.get(ml));
      if (!size) return;
      const edit = { size, qty };
      if (buyNow) editBuyNow(edit);
      else editCollection(line.key, edit);
    }
    onDone();
  }

  function onRemove() {
    if (target.kind === "item") remove(line.key);
    else removeCollection(line.key);
    onDone();
  }

  const canSave = !outOfStock && (ml === line.ml || option?.available === true);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-xl">
          {line.image && (
            <Image
              src={line.image}
              alt={line.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          )}
        </div>
        {target.kind === "collection" ? (
          <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
            {target.line.members.map((m) => (
              <li key={m.productId} className="truncate">
                <span className="text-muted-foreground">{m.brand} — </span>
                {m.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground min-w-0 flex-1 text-sm">
            {formatPrice(unitPrice)} / {ml}ml
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p
          id={`${uid}-size`}
          className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase"
        >
          Хэмжээ
        </p>
        <SizeTiles
          options={data?.options ?? null}
          failed={failed}
          value={ml}
          onPick={pickSize}
          onRetry={() => setAttempt((n) => n + 1)}
          labelledBy={`${uid}-size`}
          memberCount={
            target.kind === "collection" ? target.line.members.length : null
          }
        />
      </div>

      <div className="space-y-2">
        <p
          id={`${uid}-qty`}
          className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase"
        >
          Тоо ширхэг
        </p>
        <div className="flex items-center justify-between gap-4">
          <div
            role="group"
            aria-labelledby={`${uid}-qty`}
            className="bg-secondary flex items-center rounded-full"
          >
            <button
              type="button"
              onClick={() => {
                setQty((q) => Math.max(1, q - 1));
                setHint(null);
              }}
              disabled={qty <= 1}
              aria-label="Нэгээр хасах"
              className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full transition-colors disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-base font-medium tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              onClick={increment}
              aria-disabled={qty >= max}
              aria-label="Нэгээр нэмэх"
              className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full transition-colors aria-disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <p className="flex items-baseline gap-2 tabular-nums">
            {listTotal > lineTotal && (
              <span className="text-muted-foreground text-sm line-through">
                {formatPrice(listTotal)}
              </span>
            )}
            <span className="text-lg font-semibold">
              {formatPrice(lineTotal)}
            </span>
          </p>
        </div>
        {/* Toast биш: dialog дотор хэрэглэгчийн харж буй газарт нь. */}
        <p
          role="status"
          className={cn(
            "text-muted-foreground text-sm empty:hidden",
            outOfStock && data && "text-destructive",
          )}
        >
          {outOfStock && data
            ? "Энэ хэмжээ одоогоор сагсанд багтахгүй байна — өөр хэмжээ сонгоно уу."
            : hint}
        </p>
      </div>

      {/* Нэг өндөр (h-12), нэг эгнээ: хоёрдогч «Устгах» нь агуулгынхаа
          өргөнтэй, гол үйлдэл «Хадгалах» үлдсэн зайг бүтнээр нь эзэлнэ —
          хүрээгүй үг шиг хөвж, өөр өндөртэй товчтой зэрэгцэхээ больсон.
          Устгах нь hover/фокус дээр л улаан болно: амгалан үедээ гол
          үйлдлээс анхаарал булаахгүй. */}
      <div className="flex gap-2 pt-1">
        {!buyNow && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onRemove}
            className="hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive px-5"
          >
            <Trash2 />
            Устгах
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          onClick={save}
          disabled={!canSave}
          className="flex-1"
        >
          Хадгалах
        </Button>
      </div>
    </div>
  );
}

function SizeTiles({
  options,
  failed,
  value,
  onPick,
  onRetry,
  labelledBy,
  memberCount,
}: {
  options: SizeOption[] | null;
  failed: boolean;
  value: number;
  onPick: (ml: number) => void;
  onRetry: () => void;
  labelledBy: string;
  /** Багц бол «5ml ×4» — нэг үнэртний хэмжээ × үнэртний тоо. */
  memberCount: number | null;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  if (failed) {
    return (
      <p className="text-muted-foreground text-sm">
        Хэмжээ ачаалж чадсангүй.{" "}
        <button
          type="button"
          onClick={onRetry}
          className="text-foreground font-medium underline underline-offset-4"
        >
          Дахин оролдох
        </button>
      </p>
    );
  }
  if (!options) {
    return (
      <div className="grid grid-cols-4 gap-2" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-15 rounded-lg" />
        ))}
      </div>
    );
  }

  /** Roving tabindex — сум товчоор нүүж, байхгүй хэмжээг алгасна. */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!options) return;
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const from = options.findIndex((o) => o.ml === value);
    let next = from;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + step + options.length) % options.length;
      if (options[next].available) break;
    }
    if (next === from || !options[next].available) return;
    onPick(options[next].ml);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="grid grid-cols-4 gap-2"
    >
      {options.map((o, i) => {
        const active = o.ml === value;
        return (
          <button
            key={o.ml}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={o.available ? undefined : true}
            tabIndex={active ? 0 : -1}
            onClick={() => onPick(o.ml)}
            className={cn(
              "flex flex-col items-center rounded-lg px-1 py-2.5 transition-colors",
              !o.available
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                : active
                  ? "bg-foreground text-background"
                  : "bg-secondary hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold whitespace-nowrap",
                !o.available && "line-through",
              )}
            >
              {o.ml}ml{memberCount != null && ` ×${memberCount}`}
            </span>
            <span
              className={cn(
                "text-xs tabular-nums",
                active ? "text-background/75" : "text-muted-foreground",
              )}
            >
              {o.available ? formatPrice(o.price) : o.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Дан ус: барааны бүх идэвхтэй хэмжээ, үнэ, зарагдах эсэх + үлдэгдэл. */
async function loadItem(productId: string): Promise<Loaded> {
  const res = await fetch(
    `/api/products?ids=${encodeURIComponent(productId)}&details=1`,
  );
  if (!res.ok) throw new Error("load");
  const data = (await res.json()) as { items?: ProductDetail[] };
  const product = data.items?.find((p) => p.id === productId);
  // Хаагдсан / устсан бараа: сонголт хоосон — хадгалах боломжгүй болно.
  if (!product) throw new Error("missing");
  const variants = new Map<
    number,
    { variantId: string; price: number; sellable: boolean }
  >();
  const options: SizeOption[] = product.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.ml - b.ml)
    .map((v) => {
      variants.set(v.ml, {
        variantId: v.id,
        price: v.price,
        sellable: v.sellable,
      });
      return {
        ml: v.ml,
        price: v.price,
        available: v.sellable,
        note: v.unavailableReason === "bottle" ? "Түр байхгүй" : "Байхгүй",
      };
    });
  return {
    options,
    variants,
    stock: new Map([[product.id, product.soldOut ? 0 : product.availableMl]]),
  };
}

/** Багц: хэмжээ бүрийн үнийг серверээр үнэлүүлнэ (`/api/collections/quote`). */
async function loadCollection(
  line: CartCollection,
  productIds: string[],
): Promise<Loaded> {
  const res = await fetch("/api/collections/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collectionId: line.collectionId,
      type: line.type,
      productIds,
    }),
  });
  if (!res.ok) throw new Error("load");
  const data = (await res.json()) as {
    sizes: BundleSizeQuote[];
    stock: Record<string, number>;
  };
  return {
    options: data.sizes.map((q) => ({
      ml: q.ml,
      price: q.price,
      available: q.available,
      note: "Байхгүй",
    })),
    quotes: new Map(data.sizes.map((q) => [q.ml, q])),
    stock: new Map(Object.entries(data.stock)),
  };
}

function currentSize(c: CartCollection): CartCollectionSize {
  return {
    ml: c.ml,
    members: c.members,
    unitPrice: c.unitPrice,
    discountPct: c.discountPct,
  };
}

/**
 * Серверийн үнэлгээнээс багцын шинэ хэмжээ. Гишүүн бүрийн нэр, зураг сагсных
 * хэвээр — зөвхөн variant ба үнэ солигдоно. Гишүүний бүрэлдэхүүн зөрвөл
 * (бараа хасагдсан г.м) хадгалахгүй.
 */
function sizeFromQuote(
  c: CartCollection,
  quote: BundleSizeQuote | undefined,
): CartCollectionSize | null {
  if (!quote?.available || quote.members.length !== c.members.length)
    return null;
  const byProduct = new Map(quote.members.map((m) => [m.productId, m]));
  const members = c.members.map((m) => {
    const q = byProduct.get(m.productId);
    return q ? { ...m, variantId: q.variantId, price: q.price } : null;
  });
  if (members.some((m) => m == null)) return null;
  return {
    ml: quote.ml,
    members: members as CartCollection["members"],
    unitPrice: quote.price,
    discountPct: quote.discountPct,
  };
}
