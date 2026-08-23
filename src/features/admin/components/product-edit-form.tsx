"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { VariantPriceTable, type VariantDraft } from "./variant-price-table";
import { MultiCheck, useToggleList } from "./multi-check";
import { DescriptionFields } from "./description-fields";
import { ProductImages } from "./product-images";
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
}: {
  product: AdminProduct;
  families: ScentFamilyOption[];
  customTagPool?: CustomTagOption[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
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
  const [scentFamilies, toggleFamily] = useToggleList(product.scentFamilies);
  const [seasons, toggleSeason] = useToggleList(product.seasons, {
    exclusive: "all",
  });
  // Every store size gets a row — sizes the product doesn't have yet (e.g.
  // the 2ml sample tier on older products) start inactive at 0₮, and saving
  // them upserts the missing variant.
  const [variants, setVariants] = React.useState<VariantDraft[]>(() =>
    ML_SIZES.map((ml) => {
      const v = product.variants.find((x) => x.ml === ml);
      return v
        ? { ml, price: v.price, active: v.isActive }
        : { ml, price: 0, active: false };
    }),
  );
  const [tags, setTags] = React.useState<string[]>(product.tags);
  const [customTags, toggleCustomTag] = useToggleList(product.customTags);
  const [isActive, setIsActive] = React.useState(product.isActive);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleTag(slug: string) {
    setTags((t) =>
      t.includes(slug) ? t.filter((x) => x !== slug) : [...t, slug],
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
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
      const data = await res.json();
      if (data.demo) setMsg("Demo горим: өөрчлөлт хадгалагдсангүй.");
      else if (res.ok) router.push("/admin/products");
      else setMsg("Алдаа гарлаа.");
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
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.push("/admin/products");
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {confirmDialog}
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
            empty="Тохиргоо → Үнэрийн төрөл хэсэгт эхлээд төрөл нэмнэ үү."
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

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Зураг</h2>
          <ProductImages
            productId={product.id}
            initial={product.images.map((img) => ({
              id: img.id,
              url: img.url,
              alt: img.alt ?? "",
            }))}
          />
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
              <VariantPriceTable variants={variants} onChange={setVariants} />
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
              onCheckedChange={(v) => setIsActive(Boolean(v))}
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
        <p className="bg-secondary rounded-md px-4 py-3 text-sm">{msg}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.push("/admin/products")}
          >
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
