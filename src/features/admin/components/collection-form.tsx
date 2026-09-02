"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Search, Trash2, X } from "lucide-react";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomTagField } from "./custom-tag-field";
import { useToggleList } from "./multi-check";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { bundlePrice, discountForMl } from "@/features/collections/pricing";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GENDERS, GENDER_LABEL, BUNDLE_ML_SIZES } from "@/lib/constants";
import type { CustomTagOption } from "@/features/taxonomy/api";
import type { AdminCollection } from "./collection-admin";

/** A bundle is exactly four perfumes — the shop prices and ships it that way. */
const REQUIRED_PRODUCTS = 4;

const TAGS: { slug: "new" | "hot" | "sale"; label: string }[] = [
  { slug: "new", label: "Шинэ" },
  { slug: "hot", label: "Эрэлттэй" },
  { slug: "sale", label: "Хямдрал" },
];

/** A perfume as the picker needs it: identity plus its price at every size. */
export interface AdminProduct {
  id: string;
  name: string;
  brand: string;
  /** ₮ by ml, active variants only. A missing size cannot be bundled. */
  priceByMl: Record<number, number>;
}

/** Cover image: one file, straight into `collections.image_url`. */
function CoverImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    // Same browser-side gate the product gallery uses: validate and downscale
    // before sending, or a phone photo dies at the platform's body limit.
    const prepared = await prepareUpload(file);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", prepared.file);
    fd.append("folder", "collections");
    const res = await adminFetch<{ url?: string }>("/api/upload", {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.demo ? "Demo горим: зураг хадгалагдсангүй." : res.error);
      return;
    }
    if (!res.data?.url) {
      setError("Оруулахад алдаа гарлаа.");
      return;
    }
    onChange(res.data.url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="bg-muted/40 relative size-28 shrink-0 overflow-hidden rounded-lg">
          {value ? (
            <Image
              src={value}
              alt=""
              fill
              unoptimized
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <ImagePlus className="size-6" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Оруулж байна…
                </>
              ) : (
                <>
                  <ImagePlus className="size-4" /> Зураг сонгох
                </>
              )}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange("")}
                aria-label="Зургийг хасах"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Хоосон бол багцын эхний үнэртний зураг харагдана.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Cleared so picking the same file twice still fires a change.
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function CollectionForm({
  products,
  customTagPool = [],
  collection,
  roundTo = 100,
  defaultDiscountPct = 5,
}: {
  products: AdminProduct[];
  customTagPool?: CustomTagOption[];
  /** Absent when creating. */
  collection?: AdminCollection;
  /** settings.collection.roundTo — so the preview matches the storefront. */
  roundTo?: number;
  /** settings.collection.baseDefaultDiscountPct, for a brand-new bundle. */
  defaultDiscountPct?: number;
}) {
  const router = useRouter();
  const editing = Boolean(collection);

  const [form, setForm] = React.useState({
    name: collection?.name ?? "",
    gender: collection?.gender ?? ("unisex" as "male" | "female" | "unisex"),
    description: collection?.description ?? "",
    discountPct: collection
      ? Number(collection.discount_pct)
      : defaultDiscountPct,
    giftMl: (collection?.gift_ml ?? "") as number | "",
    imageUrl: collection?.image_url ?? "",
    isActive: collection?.is_active ?? true,
    isFeatured: collection?.is_featured ?? false,
    productIds: collection
      ? [...collection.collection_items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => i.product_id)
      : ([] as string[]),
  });

  /** Per-size override, `""` meaning "charge the default". */
  const [mlDiscounts, setMlDiscounts] = React.useState<
    Record<number, number | "">
  >(() => {
    const seed: Record<number, number | ""> = {};
    for (const ml of BUNDLE_ML_SIZES) {
      const own = (collection?.collection_ml_discounts ?? []).find(
        (d) => d.ml === ml,
      );
      seed[ml] = own ? Number(own.discount_pct) : "";
    }
    return seed;
  });

  const [tags, toggleTag] = useToggleList(
    (collection?.collection_tags ?? [])
      .map((t) => t.tags?.slug)
      .filter((s): s is string => Boolean(s)),
  );
  const [customTags, toggleCustomTag] = useToggleList(
    (collection?.collection_custom_tags ?? [])
      .map((t) => t.custom_tags?.slug)
      .filter((s): s is string => Boolean(s)),
  );

  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  /**
   * What each size would cost, live, as the operator picks perfumes and types
   * discounts. The bundle price is derived — never typed — so this table is the
   * only place the effect of a discount is visible before saving.
   */
  const rows = React.useMemo(() => {
    const members = form.productIds
      .map((id) => byId.get(id))
      .filter((p): p is AdminProduct => Boolean(p));
    return BUNDLE_ML_SIZES.map((ml) => {
      const prices = members.map((m) => m.priceByMl[ml]);
      // Every member must sell this size, or the bundle cannot be bought at it.
      const complete =
        members.length === REQUIRED_PRODUCTS &&
        prices.every((p) => typeof p === "number" && p > 0);
      const memberSum = prices.reduce((s, p) => s + (p ?? 0), 0);
      const pct = discountForMl(
        ml,
        Number(form.discountPct) || 0,
        Object.fromEntries(
          Object.entries(mlDiscounts)
            .filter(([, v]) => v !== "")
            .map(([k, v]) => [Number(k), Number(v)]),
        ),
      );
      return {
        ml,
        complete,
        memberSum,
        pct,
        price: bundlePrice(memberSum, pct, roundTo),
      };
    });
  }, [form.productIds, form.discountPct, mlDiscounts, byId, roundTo]);

  function toggleProduct(id: string) {
    setForm((f) => {
      if (f.productIds.includes(id))
        return { ...f, productIds: f.productIds.filter((x) => x !== id) };
      if (f.productIds.length >= REQUIRED_PRODUCTS) return f;
      return { ...f, productIds: [...f.productIds, id] };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.productIds.length !== REQUIRED_PRODUCTS) {
      setError(`Яг ${REQUIRED_PRODUCTS} үнэртэн сонгоно уу.`);
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await mutateJson(
      editing
        ? `/api/admin/collections/${collection!.id}`
        : "/api/admin/collections",
      editing ? "PATCH" : "POST",
      {
        name: form.name,
        gender: form.gender,
        description: form.description,
        discountPct: Number(form.discountPct),
        // Only the sizes actually overridden travel; the rest fall back to the
        // default on the server exactly as they do here.
        mlDiscounts: BUNDLE_ML_SIZES.filter(
          (ml) => mlDiscounts[ml] !== "",
        ).map((ml) => ({ ml, discountPct: Number(mlDiscounts[ml]) })),
        giftMl: form.giftMl === "" ? null : Number(form.giftMl),
        imageUrl: form.imageUrl || null,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        productIds: form.productIds,
        tags,
        customTags,
      },
      "Багц хадгалагдсангүй",
    );
    setBusy(false);
    if (!ok) {
      setError("Хадгалахад алдаа гарлаа.");
      return;
    }
    toast.success(editing ? "Багц шинэчлэгдлээ." : "Багц үүслээ.");
    router.push("/admin/collections");
    router.refresh();
  }

  const filtered = q
    ? products.filter((p) =>
        `${p.brand} ${p.name}`.toLowerCase().includes(q.toLowerCase()),
      )
    : products;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Зураг — first, matching the product form: the picture is what the
          operator has in hand when they start. */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Зураг</h2>
          <CoverImageField
            value={form.imageUrl}
            onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Үндсэн мэдээлэл</h2>
          <Field label="Нэр">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Хүйс">
              <Select
                value={form.gender}
                onValueChange={(v) =>
                  setForm({ ...form, gender: v as typeof form.gender })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {GENDER_LABEL[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Бэлгийн ml" hint="Хоосон бол үндсэн тохиргоо">
              <Input
                type="number"
                value={form.giftMl}
                onChange={(e) =>
                  setForm({
                    ...form,
                    giftMl: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder="default"
              />
            </Field>
          </div>
          <Field label="Тайлбар">
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">
            Үнэртэн ({form.productIds.length}/{REQUIRED_PRODUCTS})
          </h2>

          {form.productIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.productIds.map((id) => {
                const p = byId.get(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleProduct(id)}
                    className="bg-secondary hover:bg-accent flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                  >
                    {p ? `${p.brand} — ${p.name}` : id}
                    <X className="size-3" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Үнэртэн хайх…"
              className="pl-9"
            />
          </div>

          <div className="bg-muted/40 max-h-96 space-y-1 overflow-y-auto rounded-lg p-1">
            {filtered.map((p) => {
              const on = form.productIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  disabled={!on && form.productIds.length >= REQUIRED_PRODUCTS}
                  className={cn(
                    "hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm disabled:opacity-40",
                    on && "bg-accent",
                  )}
                >
                  <span>
                    <span className="text-muted-foreground">{p.brand}</span>{" "}
                    {p.name}
                  </span>
                  {on && <Check className="text-gold-strong size-4" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-muted-foreground p-3 text-sm">
                Илэрц олдсонгүй.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Үнэ</h2>

          <Field
            label="Үндсэн хямдрал %"
            hint="Доор өөр утга бичээгүй бүх хэмжээнд үйлчилнэ."
            className="max-w-40"
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={form.discountPct}
              onChange={(e) =>
                setForm({ ...form, discountPct: Number(e.target.value) })
              }
            />
          </Field>

          <div className="bg-muted/20 overflow-x-auto rounded-lg">
            <table className="w-full min-w-105 text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Хэмжээ
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Нийлбэр
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Хямдрал %
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Багцын үнэ
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ml} className="even:bg-muted/40">
                    <th
                      scope="row"
                      className="px-3 py-2 text-left text-base font-medium md:text-sm"
                    >
                      {r.ml}ml
                    </th>
                    <td className="text-muted-foreground px-3 py-2 tabular-nums">
                      {r.complete ? formatPrice(r.memberSum) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        // 44px on a phone: a mistap between two rows is a live
                        // pricing error, not a cosmetic one.
                        className="h-11 w-24 md:h-8 md:w-24"
                        aria-label={`${r.ml}ml-ийн хямдрал`}
                        placeholder={String(form.discountPct)}
                        value={mlDiscounts[r.ml]}
                        onChange={(e) =>
                          setMlDiscounts((d) => ({
                            ...d,
                            [r.ml]:
                              e.target.value === ""
                                ? ""
                                : Math.min(
                                    100,
                                    Math.max(0, Number(e.target.value) || 0),
                                  ),
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.complete ? (
                        <>
                          {formatPrice(r.price)}
                          <span className="text-muted-foreground ml-1 text-xs">
                            −{r.pct}%
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            Багцын үнэ нь гишүүдийн үнийн нийлбэрээс бодогдоно — гараар бичихгүй.
            Хэмжээний хямдралыг хоосон орхивол үндсэн хямдрал үйлчилнэ. «—» гэдэг
            нь тухайн хэмжээгээр аль нэг үнэртэн зарагддаггүй гэсэн үг.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Таг ба төлөв</h2>
          <div className="flex flex-wrap gap-4">
            {TAGS.map((t) => (
              <label
                key={t.slug}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={tags.includes(t.slug)}
                  onCheckedChange={() => toggleTag(t.slug)}
                />
                {t.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) =>
                  setForm({ ...form, isActive: Boolean(v) })
                }
              />
              Идэвхтэй (нийтлэх)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={form.isFeatured}
                onCheckedChange={(v) =>
                  setForm({ ...form, isFeatured: Boolean(v) })
                }
              />
              Онцлох
            </label>
          </div>
          <CustomTagField
            pool={customTagPool}
            selected={customTags}
            onToggle={toggleCustomTag}
          />
        </CardContent>
      </Card>

      {error && (
        // role="alert" so a save failure is announced, not just painted.
        <p role="alert" className="bg-secondary rounded-md px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {/* Sticky on a phone, matching the product form. */}
      <div className="bg-background/85 pb-safe sticky bottom-0 -mx-4 flex gap-3 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="flex-1 md:flex-none"
        >
          {busy ? "Хадгалж байна…" : "Багц хадгалах"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.push("/admin/collections")}
        >
          Болих
        </Button>
      </div>
    </form>
  );
}
