"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VariantPriceTable,
  emptyVariants,
  unpricedActiveSizes,
  type VariantDraft,
} from "./variant-price-table";
import { MultiCheck, useToggleList } from "./multi-check";
import { DescriptionFields } from "./description-fields";
import { ProductImages, type GalleryImage } from "./product-images";
import {
  GENDERS,
  GENDER_LABEL,
  CONCENTRATIONS,
  SEASONS,
  SEASON_LABEL,
  DEFAULT_LOW_STOCK_ML,
} from "@/lib/constants";
import type { ScentFamilyOption } from "@/lib/types";
import type { CustomTagOption } from "@/features/taxonomy/api";

const TAGS: { slug: "new" | "hot" | "sale"; label: string }[] = [
  { slug: "new", label: "Шинэ" },
  { slug: "hot", label: "Эрэлттэй" },
  { slug: "sale", label: "Хямдрал" },
];

export function ProductForm({
  families,
  customTagPool = [],
}: {
  families: ScentFamilyOption[];
  customTagPool?: CustomTagOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    brand: "",
    gender: "unisex",
    concentration: "EDP",
    notesTop: "",
    notesHeart: "",
    notesBase: "",
    description: "",
    notesDescription: "",
    usageDescription: "",
    shortDescription: "",
    originCountry: "",
    releaseYear: "",
    bottlePrice: "",
    bottleMl: "100",
    salePct: "0",
    onHandMl: "100",
    lowStockMl: String(DEFAULT_LOW_STOCK_ML),
  });

  const [variants, setVariants] = React.useState<VariantDraft[]>(emptyVariants);
  const [showVariantErrors, setShowVariantErrors] = React.useState(false);
  const [tags, toggleTag] = useToggleList([]);
  const [customTags, toggleCustomTag] = useToggleList([]);
  const [isActive, setIsActive] = React.useState(true);
  const [scentFamilies, toggleFamily] = useToggleList([]);
  const [seasons, toggleSeason] = useToggleList(["all"], { exclusive: "all" });
  // Uploaded to a staging folder before the product row exists; the create
  // route attaches them to the new product (or uses the first as the AI
  // reference in `generate` mode).
  const [images, setImages] = React.useState<GalleryImage[]>([]);
  const [imageMode, setImageMode] = React.useState<"upload" | "generate">(
    "generate",
  );

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (imageMode === "generate" && images.length === 0) {
      setResult("AI-аар үүсгэхэд лавлах зураг заавал оруулна уу.");
      return;
    }
    // Sizes now arrive unticked (variant-price-table.tsx), so a product can be
    // created with no size on sale at all — say so rather than publishing a
    // product nobody can buy.
    if (!variants.some((v) => v.active)) {
      setShowVariantErrors(true);
      setResult(
        "Ядаж нэг хэмжээг «Зарна» болгож, үнийг нь оруулна уу — эс бөгөөс энэ барааг хэн ч авч чадахгүй.",
      );
      return;
    }
    // A ticked size with no price would publish a free decant against real ml.
    const unpriced = unpricedActiveSizes(variants);
    if (unpriced.length > 0) {
      setShowVariantErrors(true);
      setResult(
        `${unpriced.join(", ")}ml зарахаар тэмдэглэсэн ч үнэгүй байна. Үнэ оруулах эсвэл «Зарна»-г авна уу.`,
      );
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        ...form,
        scentFamilies,
        seasons,
        variants,
        tags,
        customTags,
        isActive,
        imageMode,
        images: images.map((img) => ({ url: img.url, alt: img.alt })),
        releaseYear: form.releaseYear ? Number(form.releaseYear) : null,
        bottlePrice: Number(form.bottlePrice) || 0,
        bottleMl: Number(form.bottleMl) || 0,
        salePct: Math.min(100, Math.max(0, Number(form.salePct) || 0)),
        onHandMl: Number(form.onHandMl),
        lowStockMl: Number(form.lowStockMl),
        notesTop: form.notesTop
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        notesHeart: form.notesHeart
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        notesBase: form.notesBase
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await adminFetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(
          imageMode === "generate"
            ? `«${form.name}» нэмэгдлээ. Зураг бэлэн болтол бараа нуугдсан хэвээр байна.`
            : `«${form.name}» нэмэгдлээ.`,
        );
        router.push("/admin/products");
      } else if (res.demo) {
        setResult(
          "Demo горим: Supabase холбогдсоны дараа бараа бодитоор хадгалагдана.",
        );
      } else {
        // "Алдаа гарлаа." after thirty filled fields tells the operator
        // nothing — pass the server's own reason through.
        setResult(`Хадгалж чадсангүй: ${res.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Үндсэн мэдээлэл</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Нэр">
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Брэнд">
              <Input
                required
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
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

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Зураг</h2>

          {/* Mode: use the uploaded image, or generate it with AI (§2). */}
          <div className="bg-secondary flex w-fit gap-1 rounded-lg p-1 text-sm">
            {(
              [
                ["upload", "Бэлэн зураг"],
                ["generate", "AI-аар үүсгэх"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setImageMode(mode)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  imageMode === mode
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {imageMode === "generate" && (
            <p className="text-muted-foreground text-sm">
              <strong>Лавлах зураг заавал</strong> — доор үнэртний зураг
              оруулна. Хадгалахад бараа <strong>идэвхгүй</strong> статустай орж,
              зураг фоноор үүснэ. Батлагдсаны дараа нийтлэгдэнэ.
            </p>
          )}

          <ProductImages onChange={setImages} />
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
              placeholder="Бергамот, Чинжүү"
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
          <h2 className="font-serif text-lg font-semibold">Үнэ</h2>
          <VariantPriceTable
            variants={variants}
            onChange={setVariants}
            showErrors={showVariantErrors}
            idPrefix="new"
          />
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
          <Separator />
          <h2 className="font-serif text-lg font-semibold">
            Эх сав ба үлдэгдэл
          </h2>
          <p className="text-muted-foreground text-sm">
            Эх савны үнэ/багтаамж нь борлуулалт, ашгийн тайланд болон үлдэгдэл
            тооцоонд ашиглагдана — зарах үнэд нөлөөлөхгүй.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Эх савны үнэ (₮)">
              <Input
                type="number"
                value={form.bottlePrice}
                onChange={(e) => set("bottlePrice", e.target.value)}
              />
            </Field>
            <Field label="Эх савны багтаамж (ml)">
              <Input
                type="number"
                value={form.bottleMl}
                onChange={(e) => set("bottleMl", e.target.value)}
              />
            </Field>
            <Field label="Эх савны үлдэгдэл (ml)">
              <Input
                type="number"
                value={form.onHandMl}
                onChange={(e) => set("onHandMl", e.target.value)}
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

      {result && (
        // role="alert" so a save failure is announced, not just painted.
        <p role="alert" className="bg-secondary rounded-md px-4 py-3 text-sm">
          {result}
        </p>
      )}

      {/* Sticky on a phone: the submit used to sit below ~30 fields, so saving
          meant scrolling the whole form back down. `pb-safe` keeps it clear of
          the iOS home indicator. */}
      <div className="bg-background/85 pb-safe sticky bottom-0 -mx-4 flex gap-3 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="flex-1 md:flex-none"
        >
          {submitting ? "Хадгалж байна…" : "Бараа хадгалах"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.push("/admin/products")}
        >
          Болих
        </Button>
      </div>
    </form>
  );
}
