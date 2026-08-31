"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { adminFetch } from "@/features/admin/lib/mutate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENDERS,
  GENDER_LABEL,
  CONCENTRATIONS,
  ML_SIZES,
  SEASONS,
  SEASON_LABEL,
} from "@/lib/constants";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import {
  RETURN_PARAM,
  listHref,
  useUnsavedGuard,
} from "@/features/admin/lib/return-to";
import {
  VariantPriceTable,
  unpricedActiveSizes,
  type VariantDraft,
} from "./variant-price-table";
import { MultiCheck, useToggleList } from "./multi-check";
import { DescriptionFields } from "./description-fields";
import { ProductImageStudio } from "./product-image-studio";
import type { AdminProduct } from "@/features/admin/api";
import type { CustomTagOption } from "@/features/taxonomy/api";
import type { ScentFamilyOption } from "@/lib/types";
const TAGS: { slug: "new" | "hot" | "sale"; label: string }[] = [
  { slug: "new", label: "Шинэ" },
  { slug: "hot", label: "Эрэлттэй" },
  { slug: "sale", label: "Хямдрал" },
];

export function ProductEditForm({
  product,
  families,
  customTagPool = [],
  aiEnabled = false,
}: {
  product: AdminProduct;
  families: ScentFamilyOption[];
  customTagPool?: CustomTagOption[];
  /** `isImageGenConfigured` — server-only env, handed down by the page. */
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // The list's own `?q/status/sort`, carried in so saving returns to the exact
  // view the operator was working through (return-to.ts).
  const backHref = listHref(params.get(RETURN_PARAM));
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [showVariantErrors, setShowVariantErrors] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const errorRef = React.useRef<HTMLParagraphElement | null>(null);
  const [form, setForm] = React.useState({
    name: product.name,
    brand: product.brand,
    gender: product.gender,
    concentration: product.concentration,
    description: product.description,
    notesDescription: product.notesDescription,
    usageDescription: product.usageDescription,
    shortDescription: product.shortDescription,
    notesTop: product.notesTop.join(", "),
    notesHeart: product.notesHeart.join(", "),
    notesBase: product.notesBase.join(", "),
    originCountry: product.originCountry ?? "",
    releaseYear: product.releaseYear ? String(product.releaseYear) : "",
    bottlePrice: String(product.bottlePrice),
    bottleMl: String(product.bottleMl),
    salePct: String(product.salePct),
    lowStockMl: String(product.lowStockMl),
  });
  const [scentFamilies, rawToggleFamily] = useToggleList(product.scentFamilies);
  const [seasons, rawToggleSeason] = useToggleList(product.seasons, {
    exclusive: "all",
  });
  // Every store size gets a row — sizes the product doesn't sell yet start
  // inactive at 0₮, and saving them upserts the missing variant. (2ml is an
  // ordinary size like the rest, not a sample: the monthly 1ml gift is a
  // separate concept entirely.)
  const [variants, setVariants] = React.useState<VariantDraft[]>(() =>
    ML_SIZES.map((ml) => {
      const v = product.variants.find((x) => x.ml === ml);
      return v
        ? { ml, price: v.price, active: v.isActive }
        : { ml, price: 0, active: false };
    }),
  );
  const [tags, setTags] = React.useState<string[]>(product.tags);
  const [customTags, rawToggleCustomTag] = useToggleList(product.customTags);
  const [isActive, setIsActive] = React.useState(product.isActive);

  useUnsavedGuard(dirty);

  // Bring a rejection into view and announce it. Without this the message
  // renders far below the sticky footer the operator just pressed.
  React.useEffect(() => {
    if (!msg) return;
    errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    errorRef.current?.focus();
  }, [msg]);

  /** Every edit path has to mark the form dirty, or the guard lies. */
  function markDirty<T extends (...args: never[]) => void>(fn: T): T {
    return ((...args: Parameters<T>) => {
      setDirty(true);
      fn(...args);
    }) as T;
  }
  const toggleFamily = markDirty(rawToggleFamily);
  const toggleSeason = markDirty(rawToggleSeason);
  const toggleCustomTag = markDirty(rawToggleCustomTag);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleTag(slug: string) {
    setDirty(true);
    setTags((t) =>
      t.includes(slug) ? t.filter((x) => x !== slug) : [...t, slug],
    );
  }

  /** «Болих» throws away ~30 fields, so it asks first once anything changed. */
  async function cancel() {
    if (dirty) {
      const ok = await confirm({
        title: "Хадгалаагүй өөрчлөлт байна",
        description:
          "Одоо гарвал энэ барааны хийсэн засвар бүрэн алдагдана. Гарах уу?",
        confirmLabel: "Гарах",
        cancelLabel: "Үргэлжлүүлэх",
        destructive: true,
      });
      if (!ok) return;
    }
    router.push(backHref);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // A ticked size with no price publishes a free decant against real ml
    // stock — refuse before the request, and point at the rows.
    const unpriced = unpricedActiveSizes(variants);
    if (unpriced.length > 0) {
      setShowVariantErrors(true);
      setMsg(
        `${unpriced.join(", ")}ml зарахаар тэмдэглэсэн ч үнэгүй байна. Үнэ оруулах эсвэл «Зарна»-г авна уу.`,
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          brand: form.brand,
          gender: form.gender,
          concentration: form.concentration,
          scentFamilies,
          seasons,
          description: form.description,
          notesDescription: form.notesDescription,
          usageDescription: form.usageDescription,
          shortDescription: form.shortDescription,
          notesTop: split(form.notesTop),
          notesHeart: split(form.notesHeart),
          notesBase: split(form.notesBase),
          originCountry: form.originCountry || null,
          releaseYear: form.releaseYear ? Number(form.releaseYear) : null,
          bottlePrice: Number(form.bottlePrice),
          bottleMl: Number(form.bottleMl),
          salePct: Math.min(100, Math.max(0, Number(form.salePct) || 0)),
          lowStockMl: Number(form.lowStockMl),
          variants,
          isActive,
          tags,
          customTags,
        }),
      });
      if (res.ok) {
        setDirty(false);
        // Repricing is the highest-stakes thing this form does and it used to
        // complete in silence, on a list whose filters had been reset.
        toast.success(
          isActive
            ? `«${form.name}» хадгалагдлаа. Шинэ үнэ сайтад шууд харагдана.`
            : `«${form.name}» хадгалагдлаа. Бараа сайтад харагдахгүй байна.`,
        );
        router.push(backHref);
        return;
      }
      // The server's reason, not a content-free "Алдаа гарлаа."
      setMsg(`Хадгалж чадсангүй: ${res.error}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `«${product.name}» барааг устгах уу?`,
      description:
        "Бараа, түүний ml багц, үлдэгдэл, зураг бүгд устна. Буцаах боломжгүй.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDirty(false);
        toast.success(`«${product.name}» устгагдлаа.`);
        router.push(backHref);
        return;
      }
      setMsg(`Устгаж чадсангүй: ${res.error}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {confirmDialog}
      {/* The picture leads: it is the one part of a product an operator comes
          back to edit on its own, and the AI controls belong beside the gallery
          they feed rather than in a dialog on another screen. */}
      <ProductImageStudio
        productId={product.id}
        initialImages={product.images.map((img) => ({
          id: img.id,
          url: img.url,
          alt: img.alt ?? "",
          visible: img.is_visible,
        }))}
        initialReference={product.referenceImageUrl}
        initialStatus={product.imageStatus}
        initialError={product.imageError}
        aiEnabled={aiEnabled}
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Үндсэн мэдээлэл</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Нэр">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </Field>
            <Field label="Брэнд">
              <Input
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
                required
              />
            </Field>
            <Field label="Хүйс">
              <Select
                value={form.gender}
                onValueChange={(v) => set("gender", v)}
              >
                <SelectTrigger>
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
            <Field label="Төрөл">
              <Select
                value={form.concentration}
                onValueChange={(v) => set("concentration", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONCENTRATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Гаргасан он">
              <Input
                type="number"
                value={form.releaseYear}
                onChange={(e) => set("releaseYear", e.target.value)}
              />
            </Field>
          </div>

          <MultiCheck
            label="Үнэрийн төрөл (олон сонголт)"
            options={families.map((f) => ({ value: f.slug, label: f.label }))}
            selected={scentFamilies}
            onToggle={toggleFamily}
            empty="Каталог → Үнэрийн төрөл хэсэгт эхлээд төрөл нэмнэ үү."
          />
          <MultiCheck
            label="Улирал (олон сонголт)"
            options={SEASONS.map((s) => ({ value: s, label: SEASON_LABEL[s] }))}
            selected={seasons}
            onToggle={toggleSeason}
          />
          <Field label="Гарал үүсэл (улс)">
            <Input
              value={form.originCountry}
              onChange={(e) => set("originCountry", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <DescriptionFields
        value={form}
        onChange={(k, v) => set(k as keyof typeof form, v)}
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Үнэрийн нот</h2>
          <Field label="Дээд нот (таслалаар)">
            <Input
              value={form.notesTop}
              onChange={(e) => set("notesTop", e.target.value)}
            />
          </Field>
          <Field label="Зүрх нот">
            <Input
              value={form.notesHeart}
              onChange={(e) => set("notesHeart", e.target.value)}
            />
          </Field>
          <Field label="Суурь нот">
            <Input
              value={form.notesBase}
              onChange={(e) => set("notesBase", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Үнэ ба үлдэгдэл</h2>

          {variants.length > 0 && (
            <div className="space-y-2">
              <Label>Хэмжээ тус бүрийн үнэ</Label>
              <VariantPriceTable
                variants={variants}
                onChange={(v) => {
                  setDirty(true);
                  setVariants(v);
                }}
                showErrors={showVariantErrors}
                idPrefix={`edit-${product.id}`}
              />
            </div>
          )}

          <Field label="Хямдралын % (0 = хямдралгүй)">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.salePct}
              onChange={(e) => set("salePct", e.target.value)}
            />
          </Field>
          <p className="text-muted-foreground text-sm">
            Дээрх үнэ бол худалдан авагчийн төлөх үнэ. Хувь оруулбал сайт дээр
            зураастай «хуучин үнэ» болон -X% тэмдэг харагдана.
          </p>

          <p className="text-muted-foreground text-sm">
            Эх савны үнэ/багтаамж нь борлуулалт, ашгийн тайланд болон үлдэгдэл
            тооцоонд ашиглагдана — зарах үнэд нөлөөлөхгүй.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Эх савны үнэ (₮)">
              <Input
                type="number"
                value={form.bottlePrice}
                onChange={(e) => set("bottlePrice", e.target.value)}
              />
            </Field>
            <Field label="Багтаамж (ml)">
              <Input
                type="number"
                value={form.bottleMl}
                onChange={(e) => set("bottleMl", e.target.value)}
              />
            </Field>
            <Field label="Доод хязгаар (ml)">
              <Input
                type="number"
                value={form.lowStockMl}
                onChange={(e) => set("lowStockMl", e.target.value)}
              />
            </Field>
          </div>
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
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              onCheckedChange={(v) => {
                setDirty(true);
                setIsActive(Boolean(v));
              }}
            />
            Идэвхтэй (нийтлэх)
          </label>
          <MultiCheck
            label="Нэмэлт таг (дотоод — хайлт, quiz-д ашиглагдана)"
            options={customTagPool.map((t) => ({
              value: t.slug,
              label: t.name,
            }))}
            selected={customTags}
            onToggle={toggleCustomTag}
            empty="«Нэмэлт таг» хуудсанд эхлээд таг нэмнэ үү."
          />
        </CardContent>
      </Card>

      {msg && (
        // role="alert" so a save failure is announced, not just painted. The
        // ref is what brings it on screen: this sits ~2000px below the fold,
        // so a rejected save used to look like nothing had happened at all.
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="bg-secondary rounded-md px-4 py-3 text-sm"
        >
          {msg}
        </p>
      )}

      {/* Sticky on a phone — see product-form.tsx. */}
      <div className="bg-background/85 pb-safe sticky bottom-0 -mx-4 flex items-center justify-between gap-3 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex flex-1 gap-3 md:flex-none">
          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="flex-1 md:flex-none"
          >
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={cancel}>
            Болих
          </Button>
        </div>
        <Button type="button" variant="ghost" onClick={remove} disabled={busy}>
          <Trash2 className="size-4" /> Устгах
        </Button>
      </div>
    </form>
  );
}

function split(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
